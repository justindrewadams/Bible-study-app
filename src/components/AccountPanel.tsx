import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { browserSupportsWebAuthn, startAuthentication, startRegistration } from '@simplewebauthn/browser';
import { getBook } from '../data/books';
import {
  AccountError,
  api,
  passwordKey,
  passwordProblem,
  reloadMe,
  removeBookmark,
  setSignedIn,
  signOut,
  updateUser,
  useAccount,
  USERNAME_RE,
  type AccountUser,
} from '../lib/account';
import Turnstile from './Turnstile';
import { getNotes, loadNotes, placeName } from '../lib/notes';
import { NOTES_ENABLED } from '../config';

export type AccountStart =
  | { view: 'signin' | 'signup' | 'account' }
  | { view: 'verify' | 'reset' | 'email'; token: string };

interface Props {
  start: AccountStart;
  onClose: () => void;
  onOpenRef: (book: string, chapter: number, verse: number | null) => void;
  onOpenPrivacy: () => void;
}

type View = 'signin' | 'signup' | 'forgot' | 'sent' | 'reset' | 'verify' | 'email' | 'account';

/** "John 3:16" from "John.3.16" */
export function formatOsis(ref: string): string {
  const [b, c, v] = ref.split('.');
  let name = b;
  try {
    name = getBook(b).name;
  } catch {
    /* unknown book code: show as is */
  }
  return v ? `${name} ${c}:${v}` : `${name} ${c}`;
}

const msg = (e: unknown) => (e instanceof AccountError || e instanceof Error ? e.message : 'Something went wrong.');

function deviceName(): string {
  const ua = navigator.userAgent;
  if (/iPhone/.test(ua)) return 'iPhone';
  if (/iPad/.test(ua)) return 'iPad';
  if (/Android/.test(ua)) return 'Android phone';
  if (/Macintosh/.test(ua)) return 'Mac';
  if (/Windows/.test(ua)) return 'Windows computer';
  return 'This device';
}

/** Sign in, create an account, reset a password, and the account page, in one pop-up. */
export default function AccountPanel({ start, onClose, onOpenRef, onOpenPrivacy }: Props) {
  const account = useAccount();
  const [view, setView] = useState<View>(start.view === 'account' && account.status !== 'signed-in' ? 'signin' : start.view);
  const [token] = useState('token' in start ? start.token : '');
  const [prefillUser, setPrefillUser] = useState('');
  const [sentText, setSentText] = useState<ReactNode>(null);

  useEffect(() => {
    if (account.status === 'signed-in' && (view === 'signin' || view === 'signup')) setView('account');
    if (account.status === 'signed-out' && view === 'account') setView('signin');
  }, [account.status]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const title =
    view === 'signup'
      ? 'Create an account'
      : view === 'forgot'
        ? 'Forgot password'
        : view === 'reset'
          ? 'Choose a new password'
          : view === 'verify'
            ? 'Confirm your email'
            : view === 'email'
              ? 'Confirm your new email'
              : view === 'account'
                ? 'Your account'
                : view === 'sent'
                  ? 'Check your email'
                  : 'Sign in';

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal acct" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={title}>
        <div className="acct-head">
          <h2>{title}</h2>
          <button className="acct-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        {view === 'signin' && (
          <SignIn
            prefill={prefillUser}
            onSignup={() => setView('signup')}
            onForgot={() => setView('forgot')}
            onSent={(t) => {
              setSentText(t);
              setView('sent');
            }}
          />
        )}
        {view === 'signup' && (
          <SignUp
            onSignin={() => setView('signin')}
            onOpenPrivacy={onOpenPrivacy}
            onDone={(addr) => {
              setSentText(
                <>
                  We've sent a link to <strong>{addr}</strong>. Open it within 24 hours to finish creating your account.
                  If it doesn't arrive in a few minutes, check your spam folder.
                </>,
              );
              setView('sent');
            }}
          />
        )}
        {view === 'forgot' && (
          <Forgot
            onBack={() => setView('signin')}
            onDone={() => {
              setSentText(
                <>
                  If that email has an account, we've sent it a link to choose a new password. The link works once,
                  for 15 minutes. The email also reminds you of your username.
                </>,
              );
              setView('sent');
            }}
          />
        )}
        {view === 'sent' && (
          <>
            <p>{sentText}</p>
            <button className="btn" onClick={() => setView('signin')}>
              Back to sign in
            </button>
          </>
        )}
        {view === 'verify' && (
          <LinkAction
            run={() => api<{ username?: string }>('/verify', { token })}
            done="Thank you, your email is confirmed. You can sign in now."
            onDone={(r) => {
              setPrefillUser((r as { username?: string }).username ?? '');
              setView('signin');
            }}
          />
        )}
        {view === 'email' && (
          <LinkAction
            run={() => api('/email-confirm', { token })}
            done="Your new email address is saved."
            onDone={() => {
              if (account.status === 'signed-in') reloadMe().then(() => setView('account'));
              else setView('signin');
            }}
          />
        )}
        {view === 'reset' && (
          <Reset
            token={token}
            onDone={(u) => {
              setPrefillUser(u);
              setView('signin');
            }}
            onForgot={() => setView('forgot')}
          />
        )}
        {view === 'account' && account.user && (
          <AccountPage user={account.user} onOpenRef={onOpenRef} onOpenPrivacy={onOpenPrivacy} />
        )}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------------------------------ pieces

function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="acct-field">
      <span className="acct-label">{label}</span>
      {children}
      {hint && <span className="acct-hint">{hint}</span>}
    </label>
  );
}

function PasswordInput({
  value,
  onChange,
  autoComplete,
}: {
  value: string;
  onChange: (v: string) => void;
  autoComplete: 'current-password' | 'new-password';
}) {
  const [show, setShow] = useState(false);
  return (
    <span className="acct-pw">
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        maxLength={128}
        required
      />
      <button type="button" className="acct-show" onClick={() => setShow(!show)} aria-pressed={show}>
        {show ? 'Hide' : 'Show'}
      </button>
    </span>
  );
}

function Problem({ text }: { text: string | null }) {
  return text ? (
    <p className="acct-error" role="alert">
      {text}
    </p>
  ) : null;
}

function SignIn({
  prefill,
  onSignup,
  onForgot,
  onSent,
}: {
  prefill: string;
  onSignup: () => void;
  onForgot: () => void;
  onSent: (t: ReactNode) => void;
}) {
  const [username, setUsername] = useState(prefill);
  const [password, setPassword] = useState('');
  const [ts, setTs] = useState('');
  const [tsReset, setTsReset] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canPasskey = browserSupportsWebAuthn();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const u = username.trim().toLowerCase();
    if (!USERNAME_RE.test(u)) return setError('Please enter your username (not your email).');
    if (!ts) return setError('Please wait for the "verify you are human" check to finish.');
    setBusy(true);
    setError(null);
    try {
      const pw = await passwordKey(u, password);
      const { user } = await api<{ user: AccountUser }>('/login', { username: u, pw, turnstile: ts });
      setSignedIn(user);
    } catch (err) {
      if (err instanceof AccountError && err.code === 'unverified')
        onSent(<>{err.message} Open it within 24 hours, then sign in again. Check your spam folder if you don't see it.</>);
      else setError(msg(err));
      setTsReset((n) => n + 1);
    } finally {
      setBusy(false);
    }
  };

  const passkey = async () => {
    setBusy(true);
    setError(null);
    try {
      const { options, cid } = await api<{ options: Parameters<typeof startAuthentication>[0]['optionsJSON']; cid: string }>(
        '/passkey/login-options',
        {},
      );
      const response = await startAuthentication({ optionsJSON: options });
      const { user } = await api<{ user: AccountUser }>('/passkey/login', { cid, response });
      setSignedIn(user);
    } catch (err) {
      const m = msg(err);
      // the person closed the passkey prompt: no need to show an error
      if (!/NotAllowed|cancel|abort/i.test(m) && !(err instanceof Error && err.name === 'NotAllowedError')) setError(m);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="acct-form">
      <p className="acct-intro">
        An account saves your bookmarks and reading preferences, and keeps them the same on your phone and computer.
        Everything else in the app works without one.
      </p>
      <Field label="Username">
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          maxLength={30}
          required
        />
      </Field>
      <Field label="Password">
        <PasswordInput value={password} onChange={setPassword} autoComplete="current-password" />
      </Field>
      <Turnstile onToken={setTs} resetKey={tsReset} />
      <Problem text={error} />
      <div className="acct-actions">
        <button className="btn primary" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
        {canPasskey && (
          <button type="button" className="btn" onClick={passkey} disabled={busy}>
            Use a passkey
          </button>
        )}
      </div>
      <p className="acct-links">
        <button type="button" className="link-button" onClick={onForgot}>
          Forgot password or username?
        </button>
        <span aria-hidden> · </span>
        <button type="button" className="link-button" onClick={onSignup}>
          Create an account
        </button>
      </p>
    </form>
  );
}

function SignUp({
  onSignin,
  onOpenPrivacy,
  onDone,
}: {
  onSignin: () => void;
  onOpenPrivacy: () => void;
  onDone: (email: string) => void;
}) {
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [age13, setAge13] = useState(false);
  const [agree, setAgree] = useState(false);
  const [ts, setTs] = useState('');
  const [tsReset, setTsReset] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const u = username.trim().toLowerCase();
    if (!USERNAME_RE.test(u)) return setError('Usernames are 3 to 30 letters or numbers (you may also use . _ -).');
    if (!age13) return setError('You must be 13 or older to create an account.');
    if (!agree) return setError('Please agree to the privacy page and terms.');
    if (!ts) return setError('Please wait for the "verify you are human" check to finish.');
    setBusy(true);
    setError(null);
    try {
      const problem = await passwordProblem(password, u, email.trim());
      if (problem) {
        setError(problem);
        return;
      }
      const pw = await passwordKey(u, password);
      await api('/signup', { username: u, displayName, email: email.trim(), pw, age13, agree, turnstile: ts });
      onDone(email.trim());
    } catch (err) {
      setError(msg(err));
      setTsReset((n) => n + 1);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="acct-form">
      <Field label="Username" hint="You'll sign in with this. Letters and numbers; it can't be changed later. Best not to use your full real name.">
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          maxLength={30}
          required
        />
      </Field>
      <Field label="Display name (optional)" hint="Any nickname, e.g. “J” or “Grandpa Joe”.">
        <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} autoComplete="nickname" maxLength={40} />
      </Field>
      <Field label="Email" hint="Only for confirming your account and resetting your password. Kept locked (encrypted), never shared or shown to anyone.">
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" maxLength={254} required />
      </Field>
      <Field label="Password" hint="At least 10 characters. A few unrelated words together is easy to remember and hard to guess.">
        <PasswordInput value={password} onChange={setPassword} autoComplete="new-password" />
      </Field>
      <label className="acct-check">
        <input type="checkbox" checked={age13} onChange={(e) => setAge13(e.target.checked)} />
        <span>I'm 13 or older.</span>
      </label>
      <label className="acct-check">
        <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
        <span>
          I agree to the{' '}
          <button type="button" className="link-button" onClick={onOpenPrivacy}>
            privacy page and terms
          </button>
          .
        </span>
      </label>
      <Turnstile onToken={setTs} resetKey={tsReset} />
      <Problem text={error} />
      <div className="acct-actions">
        <button className="btn primary" disabled={busy}>
          {busy ? 'Creating…' : 'Create account'}
        </button>
      </div>
      <p className="acct-links">
        Already have an account?{' '}
        <button type="button" className="link-button" onClick={onSignin}>
          Sign in
        </button>
      </p>
    </form>
  );
}

function Forgot({ onBack, onDone }: { onBack: () => void; onDone: () => void }) {
  const [email, setEmail] = useState('');
  const [ts, setTs] = useState('');
  const [tsReset, setTsReset] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!ts) return setError('Please wait for the "verify you are human" check to finish.');
    setBusy(true);
    setError(null);
    try {
      await api('/forgot', { email: email.trim(), turnstile: ts });
      onDone();
    } catch (err) {
      setError(msg(err));
      setTsReset((n) => n + 1);
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={submit} className="acct-form">
      <p className="acct-intro">Enter your account's email. We'll send a link to choose a new password, and remind you of your username.</p>
      <Field label="Email">
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" maxLength={254} required />
      </Field>
      <Turnstile onToken={setTs} resetKey={tsReset} />
      <Problem text={error} />
      <div className="acct-actions">
        <button className="btn primary" disabled={busy}>
          {busy ? 'Sending…' : 'Send the link'}
        </button>
        <button type="button" className="btn" onClick={onBack}>
          Back
        </button>
      </div>
    </form>
  );
}

function LinkAction({ run, done, onDone }: { run: () => Promise<unknown>; done: string; onDone: (r: unknown) => void }) {
  const [state, setState] = useState<{ ok: boolean; text: string; r?: unknown } | null>(null);
  useEffect(() => {
    run()
      .then((r) => setState({ ok: true, text: done, r }))
      .catch((e) => setState({ ok: false, text: msg(e) }));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  if (!state) return <p className="muted">One moment…</p>;
  return (
    <>
      <p className={state.ok ? undefined : 'acct-error'}>{state.text}</p>
      <button className="btn primary" onClick={() => onDone(state.r)}>
        Continue
      </button>
    </>
  );
}

function Reset({ token, onDone, onForgot }: { token: string; onDone: (username: string) => void; onForgot: () => void }) {
  const [username, setUsername] = useState<string | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [again, setAgain] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    api<{ username: string }>('/reset-info', { token })
      .then((r) => setUsername(r.username))
      .catch((e) => setLinkError(msg(e)));
  }, [token]);

  if (linkError)
    return (
      <>
        <p className="acct-error">{linkError}</p>
        <button className="btn primary" onClick={onForgot}>
          Ask for a new link
        </button>
      </>
    );
  if (!username) return <p className="muted">One moment…</p>;
  if (finished)
    return (
      <>
        <p>Your password is changed, and every device was signed out. Please sign in with your new password.</p>
        <button className="btn primary" onClick={() => onDone(username)}>
          Sign in
        </button>
      </>
    );

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (password !== again) return setError("The two passwords don't match.");
    setBusy(true);
    setError(null);
    try {
      const problem = await passwordProblem(password, username);
      if (problem) {
        setError(problem);
        return;
      }
      await api('/reset', { token, pw: await passwordKey(username, password) });
      setFinished(true);
    } catch (err) {
      setError(msg(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="acct-form">
      <p className="acct-intro">
        Username: <strong>{username}</strong>
      </p>
      <input type="text" value={username} autoComplete="username" readOnly hidden />
      <Field label="New password" hint="At least 10 characters.">
        <PasswordInput value={password} onChange={setPassword} autoComplete="new-password" />
      </Field>
      <Field label="New password again">
        <PasswordInput value={again} onChange={setAgain} autoComplete="new-password" />
      </Field>
      <Problem text={error} />
      <div className="acct-actions">
        <button className="btn primary" disabled={busy}>
          {busy ? 'Saving…' : 'Save new password'}
        </button>
      </div>
    </form>
  );
}

// --------------------------------------------------------------------------------- account page

function AccountPage({
  user,
  onOpenRef,
  onOpenPrivacy,
}: {
  user: AccountUser;
  onOpenRef: (book: string, chapter: number, verse: number | null) => void;
  onOpenPrivacy: () => void;
}) {
  const { bookmarks } = useAccount();
  const [open, setOpen] = useState<string | null>(null);
  const toggle = (k: string) => setOpen(open === k ? null : k);

  return (
    <div className="acct-page">
      <p className="acct-intro">
        Signed in as <strong>{user.username}</strong>
        {user.displayName ? <> ({user.displayName})</> : null}. Your text size, translation and map style are saved to
        your account and follow you to your other devices.
      </p>

      <section className="acct-section">
        <h3>Bookmarks</h3>
        {bookmarks.length === 0 ? (
          <p className="muted small">Select a verse and tap “☆ Save” in the blue verse bar to bookmark it.</p>
        ) : (
          <ul className="acct-bookmarks">
            {bookmarks.map((b) => {
              const [bk, c, v] = b.ref.split('.');
              return (
                <li key={b.ref}>
                  <button className="link-button acct-bm-ref" onClick={() => onOpenRef(bk, Number(c), v ? Number(v) : null)}>
                    {formatOsis(b.ref)}
                  </button>
                  {b.label && <span className="muted"> · {b.label}</span>}
                  <button className="acct-remove" onClick={() => removeBookmark(b.ref)} aria-label={`Remove ${formatOsis(b.ref)}`}>
                    Remove
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="acct-section">
        <h3>Sign-in and security</h3>
        <Disclosure label="Passkeys (Face ID, Touch ID, screen lock)" open={open === 'passkeys'} onToggle={() => toggle('passkeys')}>
          <Passkeys user={user} />
        </Disclosure>
        <Disclosure label="Change password" open={open === 'password'} onToggle={() => toggle('password')}>
          <ChangePassword user={user} onDone={() => setOpen(null)} />
        </Disclosure>
        <Disclosure label={`Email: ${user.email}`} open={open === 'email'} onToggle={() => toggle('email')}>
          <ChangeEmail user={user} />
        </Disclosure>
        <Disclosure label="Display name" open={open === 'name'} onToggle={() => toggle('name')}>
          <ChangeName user={user} onDone={() => setOpen(null)} />
        </Disclosure>
        <div className="acct-actions">
          <button className="btn" onClick={() => signOut(false)}>
            Sign out
          </button>
          <button className="btn" onClick={() => signOut(true)}>
            Sign out everywhere
          </button>
        </div>
      </section>

      <section className="acct-section">
        <h3>Your data</h3>
        <div className="acct-actions">
          <button className="btn" onClick={downloadData}>
            Download my data
          </button>
          <button className="btn" onClick={() => toggle('delete')} aria-expanded={open === 'delete'}>
            Delete my account…
          </button>
        </div>
        {open === 'delete' && <DeleteAccount user={user} />}
        <p className="small muted">
          <button className="link-button" onClick={onOpenPrivacy}>
            Privacy & terms
          </button>
        </p>
      </section>
    </div>
  );
}

function Disclosure({ label, open, onToggle, children }: { label: string; open: boolean; onToggle: () => void; children: ReactNode }) {
  return (
    <div className={`acct-disc${open ? ' open' : ''}`}>
      <button className="acct-disc-btn" onClick={onToggle} aria-expanded={open}>
        <span>{label}</span>
        <span aria-hidden>{open ? '−' : '+'}</span>
      </button>
      {open && <div className="acct-disc-body">{children}</div>}
    </div>
  );
}

async function downloadData() {
  try {
    const data = (await api('/export')) as Record<string, unknown>;
    // notes and notebooks are unlocked in batches, so the app adds them here
    if (NOTES_ENABLED) await loadNotes(true);
    const s = getNotes();
    data.notebooks = s.notebooks.map((b) => ({ name: b.name, folderOf: b.parentId ? placeName(b.parentId, s) : null }));
    data.notes = s.notes.map((n) => ({
      kind: n.kind === 'page' ? 'notebook page' : 'verse note',
      notebook: placeName(n.notebookId, s) || null,
      ...(n.kind === 'verse' ? { verse: n.ref, to: n.end ?? null } : { title: n.title, date: n.date ?? null, passages: n.passages ?? [] }),
      text: n.body,
      created: new Date(n.createdAt * 1000).toISOString(),
      changed: new Date(n.updatedAt * 1000).toISOString(),
    }));
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'ancient-pathfinder-my-data.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  } catch (e) {
    alert(msg(e));
  }
}

function Passkeys({ user }: { user: AccountUser }) {
  const [adding, setAdding] = useState(false);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const supported = browserSupportsWebAuthn();

  const add = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const pw = await passwordKey(user.username, password);
      const { options, cid } = await api<{ options: Parameters<typeof startRegistration>[0]['optionsJSON']; cid: string }>(
        '/passkey/register-options',
        { pw },
      );
      const response = await startRegistration({ optionsJSON: options });
      await api('/passkey/register', { cid, response, name: deviceName() });
      await reloadMe();
      setAdding(false);
      setPassword('');
      setNote('Passkey added. Next time, choose “Use a passkey” to sign in.');
    } catch (err) {
      const m = msg(err);
      setError(/NotAllowed|cancel|abort/i.test(m) ? 'The passkey wasn’t added.' : m);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm('Remove this passkey? That device will need your password to sign in.')) return;
    try {
      await api('/passkey/delete', { id });
      await reloadMe();
    } catch (e) {
      setError(msg(e));
    }
  };

  return (
    <div>
      <p className="small">
        A passkey lets this device sign you in with Face ID, Touch ID or its screen lock instead of your password. Nothing
        about your face or fingerprint ever leaves your device.
      </p>
      {user.passkeys.length > 0 && (
        <ul className="acct-passkeys">
          {user.passkeys.map((p) => (
            <li key={p.id}>
              <span>
                {p.name || 'Passkey'}
                <span className="muted small"> · added {new Date(p.createdAt * 1000).toLocaleDateString()}</span>
              </span>
              <button className="acct-remove" onClick={() => remove(p.id)}>
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
      {note && <p className="small acct-ok">{note}</p>}
      {!supported ? (
        <p className="small muted">This browser can't use passkeys.</p>
      ) : adding ? (
        <form onSubmit={add} className="acct-form">
          <Field label="Your password" hint="Needed once to add a passkey.">
            <PasswordInput value={password} onChange={setPassword} autoComplete="current-password" />
          </Field>
          <Problem text={error} />
          <div className="acct-actions">
            <button className="btn primary" disabled={busy}>
              {busy ? 'Waiting…' : 'Continue'}
            </button>
            <button type="button" className="btn" onClick={() => setAdding(false)}>
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button className="btn" onClick={() => setAdding(true)}>
          Add a passkey on this device
        </button>
      )}
    </div>
  );
}

function ChangePassword({ user, onDone }: { user: AccountUser; onDone: () => void }) {
  const [current, setCurrent] = useState('');
  const [password, setPassword] = useState('');
  const [again, setAgain] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (password !== again) return setError("The two new passwords don't match.");
    setBusy(true);
    setError(null);
    try {
      const problem = await passwordProblem(password, user.username, user.email);
      if (problem) return setError(problem);
      await api('/password', {
        current: await passwordKey(user.username, current),
        pw: await passwordKey(user.username, password),
      });
      setOk(true);
      setTimeout(onDone, 2500);
    } catch (err) {
      setError(msg(err));
    } finally {
      setBusy(false);
    }
  };
  if (ok) return <p className="small acct-ok">Password changed. Your other devices were signed out.</p>;
  return (
    <form onSubmit={submit} className="acct-form">
      <input type="text" value={user.username} autoComplete="username" readOnly hidden />
      <Field label="Current password">
        <PasswordInput value={current} onChange={setCurrent} autoComplete="current-password" />
      </Field>
      <Field label="New password" hint="At least 10 characters.">
        <PasswordInput value={password} onChange={setPassword} autoComplete="new-password" />
      </Field>
      <Field label="New password again">
        <PasswordInput value={again} onChange={setAgain} autoComplete="new-password" />
      </Field>
      <Problem text={error} />
      <button className="btn primary" disabled={busy}>
        {busy ? 'Saving…' : 'Change password'}
      </button>
    </form>
  );
}

function ChangeEmail({ user }: { user: AccountUser }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api('/email', { email: email.trim(), pw: await passwordKey(user.username, password) });
      setSent(true);
    } catch (err) {
      setError(msg(err));
    } finally {
      setBusy(false);
    }
  };
  if (sent)
    return (
      <p className="small acct-ok">
        We've sent a link to the new address. It works for one hour. Your email stays the same until you open it.
      </p>
    );
  return (
    <form onSubmit={submit} className="acct-form">
      <Field label="New email">
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" maxLength={254} required />
      </Field>
      <Field label="Your password">
        <PasswordInput value={password} onChange={setPassword} autoComplete="current-password" />
      </Field>
      <Problem text={error} />
      <button className="btn primary" disabled={busy}>
        {busy ? 'Sending…' : 'Send a confirmation link'}
      </button>
    </form>
  );
}

function ChangeName({ user, onDone }: { user: AccountUser; onDone: () => void }) {
  const [name, setName] = useState(user.displayName ?? '');
  const [error, setError] = useState<string | null>(null);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const r = await api<{ displayName: string | null }>('/display-name', { displayName: name });
      updateUser({ displayName: r.displayName });
      onDone();
    } catch (err) {
      setError(msg(err));
    }
  };
  return (
    <form onSubmit={submit} className="acct-form">
      <Field label="Display name (optional)" hint="Any nickname. Leave empty to show just your username.">
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} />
      </Field>
      <Problem text={error} />
      <button className="btn primary">Save</button>
    </form>
  );
}

function DeleteAccount({ user }: { user: AccountUser }) {
  const [password, setPassword] = useState('');
  const [sure, setSure] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!sure) return setError('Please tick the box to confirm.');
    setBusy(true);
    setError(null);
    try {
      await api('/delete', { pw: await passwordKey(user.username, password) });
      await signOut(false).catch(() => {});
    } catch (err) {
      setError(msg(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={submit} className="acct-form acct-danger">
      <p className="small">
        This erases your account, email address, bookmarks, preferences and passkeys right away. It can't be undone.
      </p>
      <input type="text" value={user.username} autoComplete="username" readOnly hidden />
      <Field label="Your password">
        <PasswordInput value={password} onChange={setPassword} autoComplete="current-password" />
      </Field>
      <label className="acct-check">
        <input type="checkbox" checked={sure} onChange={(e) => setSure(e.target.checked)} />
        <span>I understand everything will be erased.</span>
      </label>
      <Problem text={error} />
      <button className="btn danger" disabled={busy}>
        {busy ? 'Deleting…' : 'Delete my account'}
      </button>
    </form>
  );
}
