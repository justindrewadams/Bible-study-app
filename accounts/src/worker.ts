/**
 * Ancient Pathfinder accounts (a Cloudflare Worker with a D1 database).
 *
 * Built into accounts/accounts-worker.js by `npm run build:accounts`; the owner pastes that file into the
 * Cloudflare dashboard (see accounts/README.md). Separate from the Bible relay on purpose.
 *
 * Security summary (details in accounts/README.md):
 * - passwords are stretched in the browser (PBKDF2 600,000 rounds) and checked here with a secret pepper
 * - email addresses are stored encrypted, plus a one-way fingerprint for lookups
 * - sign-in cookie: random, HttpOnly, Secure, SameSite=Strict, host-only (__Host-); only its hash is stored
 * - emailed links: random, single use, stored hashed; reset 15 minutes, confirm 24 hours, email change 1 hour
 * - every request must come from the app's own address; JSON only; attempt limits; Turnstile bot check
 * - no internet addresses stored (attempt counters use a keyed fingerprint and expire within a day)
 */
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server';
import {
  b64url,
  checkClientKey,
  decryptEmail,
  emailFingerprint,
  encryptEmail,
  fromB64url,
  hashClientKey,
  hmac,
  keysFor,
  randomToken,
  sha256,
  utf8,
  type Keys,
} from './crypto';
import { sendEmail, type Mail } from './email';
import { NOTE_ROUTES } from './notes';
import { LESSON_ROUTES } from './lessons';

export interface Env {
  DB: D1Database;
  /** secret: 32 random bytes, base64. Never change it once set. */
  DATA_KEY: string;
  /** secret: Brevo API key (sends confirmation and reset emails) */
  BREVO_API_KEY?: string;
  /** secret: Cloudflare Turnstile secret key */
  TURNSTILE_SECRET?: string;
  /** plain variable: usernames (comma-separated) that may take down shared lessons and get reports */
  ADMIN_USERNAMES?: string;
  /** set to "1" to switch accounts off (the app then says sign-in is unavailable) */
  ACCOUNTS_OFF?: string;
  // Only for testing on a computer (wrangler dev). Leave unset on Cloudflare.
  DEV?: string;
  SITE_URL?: string;
  ALLOWED_ORIGINS?: string;
  RP_ID?: string;
}

const PROD = {
  site: 'https://ancientpathfinder.com',
  origins: ['https://ancientpathfinder.com', 'https://www.ancientpathfinder.com'],
  rpID: 'ancientpathfinder.com',
};

const DAY = 86400;
const SESSION_DAYS = 30;
const RESET_MINUTES = 15;
const VERIFY_HOURS = 24;
const EMAIL_CHANGE_MINUTES = 60;
// a full notebook page (20,000 characters, up to 3 bytes each, plus JSON escaping) must fit
// (a journey of up to 150 stops with notes fits too)
const MAX_BODY = 400 * 1024;
const MAX_BOOKMARKS = 2000;
const MAX_PASSKEYS = 10;

export const now = () => Math.floor(Date.now() / 1000);

export interface Ctx {
  env: Env;
  req: Request;
  exec: ExecutionContext;
  keys: Keys;
  origin: string;
  dev: boolean;
  site: string;
  origins: string[];
  rpID: string;
  /** cookies to set on the response */
  setCookie: string[];
}

interface UserRow {
  id: string;
  username: string;
  display_name: string | null;
  email_enc: string;
  email_hash: string;
  verified: number;
  pw: string;
  prefs: string | null;
  created_at: number;
}

export class HttpError extends Error {
  /** more fields for the answer (e.g. the newer copy of a note) */
  extra?: Record<string, unknown>;
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message);
  }
}

// ---------------------------------------------------------------------------------------------- entry

export default {
  async fetch(req: Request, env: Env, exec: ExecutionContext): Promise<Response> {
    const dev = env.DEV === '1' && /^(localhost|127\.0\.0\.1)$/.test(new URL(req.url).hostname);
    const origins = dev && env.ALLOWED_ORIGINS ? env.ALLOWED_ORIGINS.split(',').map((s) => s.trim()) : PROD.origins;
    const origin = req.headers.get('Origin') ?? '';
    const allowed = origins.includes(origin);
    const cors: Record<string, string> = allowed
      ? {
          'Access-Control-Allow-Origin': origin,
          'Access-Control-Allow-Credentials': 'true',
          Vary: 'Origin',
        }
      : { Vary: 'Origin' };

    if (req.method === 'OPTIONS') {
      if (!allowed) return new Response(null, { status: 403 });
      return new Response(null, {
        status: 204,
        headers: {
          ...cors,
          'Access-Control-Allow-Methods': 'GET, POST',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Max-Age': '600',
        },
      });
    }

    const headers: Record<string, string> = {
      ...cors,
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
      'X-Frame-Options': 'DENY',
      'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
    };
    const out = (status: number, body: unknown, cookies: string[] = []) => {
      const h = new Headers(headers);
      cookies.forEach((c) => h.append('Set-Cookie', c));
      return new Response(JSON.stringify(body), { status, headers: h });
    };

    // Only the app itself may talk to this service.
    if (!allowed) return out(403, { error: 'This service only answers the Ancient Pathfinder app.' });
    if (env.ACCOUNTS_OFF === '1') return out(503, { error: 'Accounts are switched off for now.', code: 'off' });
    if (!env.DATA_KEY) return out(503, { error: 'Accounts are not set up yet.', code: 'off' });

    const ctx: Ctx = {
      env,
      req,
      exec,
      keys: await keysFor(env.DATA_KEY),
      origin,
      dev,
      site: dev && env.SITE_URL ? env.SITE_URL : PROD.site,
      origins,
      rpID: dev && env.RP_ID ? env.RP_ID : PROD.rpID,
      setCookie: [],
    };

    // tidy up expired rows now and then (no scheduled job needed)
    if (Math.random() < 0.05) exec.waitUntil(cleanup(env.DB).catch(() => {}));

    try {
      const path = new URL(req.url).pathname.replace(/\/+$/, '') || '/';
      const route = ROUTES[`${req.method} ${path}`];
      if (!route) throw new HttpError(404, 'Not found.');
      let body: Record<string, unknown> = {};
      if (req.method === 'POST') {
        if (!(req.headers.get('Content-Type') ?? '').startsWith('application/json'))
          throw new HttpError(415, 'Expected JSON.');
        const text = await req.text();
        if (text.length > MAX_BODY) throw new HttpError(413, 'Too much data.');
        try {
          body = text ? JSON.parse(text) : {};
        } catch {
          throw new HttpError(400, 'Invalid request.');
        }
        if (typeof body !== 'object' || body === null || Array.isArray(body)) throw new HttpError(400, 'Invalid request.');
      }
      const result = await route(ctx, body);
      return out(200, result ?? { ok: true }, ctx.setCookie);
    } catch (e) {
      if (e instanceof HttpError) return out(e.status, { error: e.message, code: e.code, ...e.extra }, ctx.setCookie);
      console.error('accounts error', e instanceof Error ? e.message : String(e));
      return out(500, { error: 'Something went wrong. Please try again.' }, ctx.setCookie);
    }
  },
};

export type Route = (ctx: Ctx, body: Record<string, unknown>) => Promise<unknown>;

// ------------------------------------------------------------------------------------------- helpers

export function str(body: Record<string, unknown>, key: string, max = 200): string {
  const v = body[key];
  if (typeof v !== 'string') return '';
  return v.length > max ? v.slice(0, max) : v;
}

const USERNAME_RE = /^[a-z0-9][a-z0-9_.-]{2,29}$/;
const CLIENT_KEY_RE = /^[A-Za-z0-9_-]{43}$/;
const EMAIL_RE = /^[^\s@<>()",;:\\]+@[^\s@<>()",;:\\]+\.[^\s@<>()",;:\\]{2,}$/;
const REF_RE = /^[1-3]?[A-Z][A-Za-z]{1,5}\.\d{1,3}(\.\d{1,3})?$/;

function username(body: Record<string, unknown>): string {
  const u = str(body, 'username', 60).trim().toLowerCase();
  if (!USERNAME_RE.test(u))
    throw new HttpError(400, 'Usernames are 3 to 30 letters or numbers (you may also use . _ -).', 'username');
  return u;
}

function clientKey(body: Record<string, unknown>, key = 'pw'): string {
  const k = str(body, key, 100);
  if (!CLIENT_KEY_RE.test(k)) throw new HttpError(400, 'Invalid password.', 'password');
  return k;
}

function email(body: Record<string, unknown>): string {
  const e = str(body, 'email', 300).trim().toLowerCase();
  if (e.length > 254 || !EMAIL_RE.test(e)) throw new HttpError(400, 'Please enter a valid email address.', 'email');
  return e;
}

/** a short line of the person's own text: no control characters, collapsed spaces */
export function cleanText(s: string, max: number): string {
  // eslint-disable-next-line no-control-regex
  return s.replace(/[\u0000-\u001f\u007f​-‏‪-‮⁦-⁩]/g, '').replace(/\s+/g, ' ').trim().slice(0, max);
}

export function clientIP(ctx: Ctx): string {
  return ctx.req.headers.get('CF-Connecting-IP') ?? (ctx.dev ? 'dev' : 'unknown');
}

/**
 * Count an attempt; refuse once `limit` is passed within `windowSec`. The stored key is a keyed fingerprint,
 * never the internet address or name itself, and the row expires with its window (at most a day).
 */
export async function limit(ctx: Ctx, action: string, who: string, max: number, windowSec: number) {
  const key = b64url(await hmac(ctx.keys.rate, `${action}|${who}`)).slice(0, 32);
  const t = now();
  const row = await ctx.env.DB.prepare(
    `INSERT INTO rate (key, n, expires_at) VALUES (?1, 1, ?2)
     ON CONFLICT(key) DO UPDATE SET
       n = CASE WHEN rate.expires_at <= ?3 THEN 1 ELSE rate.n + 1 END,
       expires_at = CASE WHEN rate.expires_at <= ?3 THEN ?2 ELSE rate.expires_at END
     RETURNING n`,
  )
    .bind(key, t + Math.min(windowSec, DAY), t)
    .first<{ n: number }>();
  if (!row || row.n > max)
    throw new HttpError(429, 'Too many attempts. Please wait a while and try again.', 'rate');
}

export async function turnstile(ctx: Ctx, body: Record<string, unknown>) {
  const token = str(body, 'turnstile', 4096);
  const secret = ctx.env.TURNSTILE_SECRET;
  if (!secret) {
    if (ctx.dev) return;
    throw new HttpError(503, 'Sign-in is not set up yet.', 'off');
  }
  if (!token) throw new HttpError(400, 'Please complete the "verify you are human" check.', 'turnstile');
  const form = new FormData();
  form.append('secret', secret);
  form.append('response', token);
  const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: form });
  const j = (await r.json().catch(() => ({}))) as { success?: boolean };
  if (!j.success) throw new HttpError(400, 'The "verify you are human" check didn\'t pass. Please try again.', 'turnstile');
}

function cookieName(ctx: Ctx) {
  return ctx.dev ? 'ap_dev_session' : '__Host-ap_session';
}

function sessionCookie(ctx: Ctx, value: string, maxAge: number) {
  const secure = ctx.dev ? '' : ' Secure;';
  return `${cookieName(ctx)}=${value}; Path=/; HttpOnly;${secure} SameSite=Strict; Max-Age=${maxAge}`;
}

function readCookie(ctx: Ctx): string | null {
  const raw = ctx.req.headers.get('Cookie') ?? '';
  for (const part of raw.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === cookieName(ctx)) return v.join('=');
  }
  return null;
}

async function startSession(ctx: Ctx, userId: string) {
  const token = randomToken(32);
  const t = now();
  await ctx.env.DB.prepare('INSERT INTO sessions (id_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)')
    .bind(await sha256(token), userId, t, t + SESSION_DAYS * DAY)
    .run();
  ctx.setCookie.push(sessionCookie(ctx, token, SESSION_DAYS * DAY));
}

async function currentSession(ctx: Ctx): Promise<{ user: UserRow; sessionHash: string } | null> {
  const token = readCookie(ctx);
  if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  const h = await sha256(token);
  const t = now();
  const row = await ctx.env.DB.prepare(
    `SELECT u.*, s.expires_at AS s_exp FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.id_hash = ? AND s.expires_at > ?`,
  )
    .bind(h, t)
    .first<UserRow & { s_exp: number }>();
  if (!row) {
    ctx.setCookie.push(sessionCookie(ctx, '', 0));
    return null;
  }
  // keep active people signed in: extend once less than half the time is left
  if (row.s_exp - t < (SESSION_DAYS * DAY) / 2) {
    await ctx.env.DB.prepare('UPDATE sessions SET expires_at = ? WHERE id_hash = ?')
      .bind(t + SESSION_DAYS * DAY, h)
      .run();
    ctx.setCookie.push(sessionCookie(ctx, token, SESSION_DAYS * DAY));
  }
  return { user: row, sessionHash: h };
}

export async function requireUser(ctx: Ctx) {
  const s = await currentSession(ctx);
  if (!s) throw new HttpError(401, 'Please sign in again.', 'signed-out');
  return s;
}

async function requirePassword(ctx: Ctx, user: UserRow, body: Record<string, unknown>, key = 'pw') {
  await limit(ctx, 'pwcheck', user.id, 10, 3600);
  const k = clientKey(body, key);
  if (!(await checkClientKey(ctx.keys, k, user.pw))) throw new HttpError(401, 'That password isn\'t right.', 'password');
}

async function newToken(ctx: Ctx, userId: string, kind: string, seconds: number, data: string | null = null) {
  const token = randomToken(32);
  await ctx.env.DB.prepare('INSERT INTO tokens (token_hash, user_id, kind, data, expires_at) VALUES (?, ?, ?, ?, ?)')
    .bind(await sha256(token), userId, kind, data, now() + seconds)
    .run();
  return token;
}

/** Look up an emailed link's code. Single use: `consume` deletes it. */
async function findToken(ctx: Ctx, token: string, kind: string, consume: boolean) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  const h = await sha256(token);
  const row = await ctx.env.DB.prepare('SELECT * FROM tokens WHERE token_hash = ? AND kind = ? AND expires_at > ?')
    .bind(h, kind, now())
    .first<{ token_hash: string; user_id: string; data: string | null }>();
  if (row && consume) await ctx.env.DB.prepare('DELETE FROM tokens WHERE token_hash = ?').bind(h).run();
  return row;
}

export function mail(ctx: Ctx, m: Mail) {
  // sent in the background, so the answer takes the same time whether or not an email goes out
  ctx.exec.waitUntil(
    sendEmail(ctx.env, ctx.dev, m).catch((e) => console.error('email failed', e instanceof Error ? e.message : String(e))),
  );
}

const hello = (u: Pick<UserRow, 'username' | 'display_name'>) => `Hello ${u.display_name || u.username},`;
const FOOTER =
  '\n\n— Ancient Pathfinder (https://ancientpathfinder.com)\nThis is an automatic message; replies are not read. Privacy: https://ancientpathfinder.com/#privacy';

export function isAdmin(ctx: Ctx, username: string): boolean {
  return (ctx.env.ADMIN_USERNAMES ?? '')
    .split(',')
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean)
    .includes(username.toLowerCase());
}

async function publicUser(ctx: Ctx, u: UserRow) {
  const passkeys = await ctx.env.DB.prepare(
    'SELECT id, name, created_at, last_used FROM passkeys WHERE user_id = ? ORDER BY created_at',
  )
    .bind(u.id)
    .all<{ id: string; name: string | null; created_at: number; last_used: number | null }>();
  let prefs: unknown = null;
  try {
    prefs = u.prefs ? JSON.parse(u.prefs) : null;
  } catch {
    prefs = null;
  }
  return {
    username: u.username,
    displayName: u.display_name,
    email: await decryptEmail(ctx.keys, u.email_enc),
    createdAt: u.created_at,
    isAdmin: isAdmin(ctx, u.username),
    prefs,
    passkeys: passkeys.results.map((p) => ({ id: p.id, name: p.name, createdAt: p.created_at, lastUsed: p.last_used })),
  };
}

async function cleanup(db: D1Database) {
  const t = now();
  await db.batch([
    db.prepare('DELETE FROM sessions WHERE expires_at <= ?').bind(t),
    db.prepare('DELETE FROM tokens WHERE expires_at <= ?').bind(t),
    db.prepare('DELETE FROM challenges WHERE expires_at <= ?').bind(t),
    db.prepare('DELETE FROM rate WHERE expires_at <= ?').bind(t),
    // accounts never confirmed within a day are removed (frees the username, forgets the email)
    db.prepare('DELETE FROM users WHERE verified = 0 AND created_at <= ?').bind(t - VERIFY_HOURS * 3600),
  ]);
}

// -------------------------------------------------------------------------------------------- routes

const ROUTES: Record<string, Route> = {
  /** Who is signed in (or 401). */
  'GET /me': async (ctx) => {
    const s = await requireUser(ctx);
    return { user: await publicUser(ctx, s.user) };
  },

  'POST /signup': async (ctx, body) => {
    await limit(ctx, 'signup', clientIP(ctx), 5, 3600);
    const u = username(body);
    const addr = email(body);
    const pw = clientKey(body);
    const display = cleanText(str(body, 'displayName', 100), 40) || null;
    if (body.age13 !== true) throw new HttpError(400, 'You must be 13 or older to create an account.', 'age');
    if (body.agree !== true) throw new HttpError(400, 'Please agree to the privacy page and terms.', 'agree');
    await turnstile(ctx, body);

    const db = ctx.env.DB;
    const t = now();
    // an unconfirmed account older than a day no longer holds its username or email
    await db.prepare('DELETE FROM users WHERE verified = 0 AND created_at <= ?').bind(t - VERIFY_HOURS * 3600).run();
    if (await db.prepare('SELECT 1 FROM users WHERE username = ?').bind(u).first())
      throw new HttpError(409, 'That username is taken. Please choose another.', 'username');

    const fp = await emailFingerprint(ctx.keys, addr);
    const existing = await db.prepare('SELECT * FROM users WHERE email_hash = ?').bind(fp).first<UserRow>();
    if (existing) {
      // Don't reveal that this email has an account: answer as usual, and tell the email's owner instead.
      await limit(ctx, 'exists-mail', fp, 2, DAY);
      mail(ctx, {
        to: addr,
        subject: 'Someone tried to create an Ancient Pathfinder account with your email',
        text: `${hello(existing)}\n\nSomeone just tried to create a new Ancient Pathfinder account with this email address, but you already have one. Your username is: ${existing.username}\n\nIf that was you, sign in with that username, or use "Forgot password" on the sign-in screen.\nIf it wasn't you, you can ignore this email. Nothing has changed.${FOOTER}`,
      });
      return { ok: true };
    }

    const id = randomToken(16);
    await db
      .prepare(
        'INSERT INTO users (id, username, display_name, email_enc, email_hash, verified, pw, prefs, created_at) VALUES (?, ?, ?, ?, ?, 0, ?, NULL, ?)',
      )
      .bind(id, u, display, await encryptEmail(ctx.keys, addr), fp, await hashClientKey(ctx.keys, pw), t)
      .run();
    const token = await newToken(ctx, id, 'verify', VERIFY_HOURS * 3600);
    mail(ctx, {
      to: addr,
      subject: 'Confirm your Ancient Pathfinder account',
      text: `${hello({ username: u, display_name: display })}\n\nTo finish creating your account (username: ${u}), open this link within 24 hours:\n\n${ctx.site}/#account/verify/${token}\n\nIf you didn't create this account, you can ignore this email. It will be removed automatically.${FOOTER}`,
    });
    return { ok: true };
  },

  'POST /verify': async (ctx, body) => {
    await limit(ctx, 'link', clientIP(ctx), 30, 3600);
    const row = await findToken(ctx, str(body, 'token', 100), 'verify', true);
    if (!row) throw new HttpError(400, 'This link has expired or was already used.', 'link');
    await ctx.env.DB.prepare('UPDATE users SET verified = 1 WHERE id = ?').bind(row.user_id).run();
    const u = await ctx.env.DB.prepare('SELECT username FROM users WHERE id = ?').bind(row.user_id).first<{ username: string }>();
    return { ok: true, username: u?.username };
  },

  'POST /login': async (ctx, body) => {
    const u = username(body);
    await limit(ctx, 'login-ip', clientIP(ctx), 20, 900);
    await limit(ctx, 'login-user', u, 10, 900);
    const pw = clientKey(body);
    await turnstile(ctx, body);
    const user = await ctx.env.DB.prepare('SELECT * FROM users WHERE username = ?').bind(u).first<UserRow>();
    // same work and the same answer whether the username exists or not
    const ok = await checkClientKey(ctx.keys, pw, user?.pw ?? 's1$AAAAAAAAAAAAAAAAAAAAAA$x');
    if (!user || !ok) throw new HttpError(401, 'That username or password isn\'t right.', 'credentials');
    if (!user.verified) {
      await limit(ctx, 'resend', user.id, 3, 3600);
      await ctx.env.DB.prepare("DELETE FROM tokens WHERE user_id = ? AND kind = 'verify'").bind(user.id).run();
      const token = await newToken(ctx, user.id, 'verify', VERIFY_HOURS * 3600);
      mail(ctx, {
        to: await decryptEmail(ctx.keys, user.email_enc),
        subject: 'Confirm your Ancient Pathfinder account',
        text: `${hello(user)}\n\nTo finish creating your account (username: ${user.username}), open this link within 24 hours:\n\n${ctx.site}/#account/verify/${token}${FOOTER}`,
      });
      throw new HttpError(403, 'Please confirm your email first. We\'ve sent a new link.', 'unverified');
    }
    await startSession(ctx, user.id);
    return { user: await publicUser(ctx, user) };
  },

  'POST /logout': async (ctx) => {
    const s = await currentSession(ctx);
    if (s) await ctx.env.DB.prepare('DELETE FROM sessions WHERE id_hash = ?').bind(s.sessionHash).run();
    ctx.setCookie.push(sessionCookie(ctx, '', 0));
    return { ok: true };
  },

  'POST /logout-all': async (ctx) => {
    const s = await requireUser(ctx);
    await ctx.env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(s.user.id).run();
    ctx.setCookie.push(sessionCookie(ctx, '', 0));
    return { ok: true };
  },

  /** "Forgot password": always the same answer, whether or not the email has an account. */
  'POST /forgot': async (ctx, body) => {
    const addr = email(body);
    await limit(ctx, 'forgot-ip', clientIP(ctx), 10, 3600);
    await turnstile(ctx, body);
    const fp = await emailFingerprint(ctx.keys, addr);
    const user = await ctx.env.DB.prepare('SELECT * FROM users WHERE email_hash = ?').bind(fp).first<UserRow>();
    if (user) {
      try {
        await limit(ctx, 'forgot-email', fp, 3, 3600);
      } catch {
        return { ok: true }; // quietly: never flood someone's inbox, and don't reveal the account
      }
      await ctx.env.DB.prepare("DELETE FROM tokens WHERE user_id = ? AND kind = 'reset'").bind(user.id).run();
      const token = await newToken(ctx, user.id, 'reset', RESET_MINUTES * 60);
      mail(ctx, {
        to: addr,
        subject: 'Reset your Ancient Pathfinder password',
        text: `${hello(user)}\n\nSomeone (hopefully you) asked to reset the password for your Ancient Pathfinder account.\nYour username is: ${user.username}\n\nTo choose a new password, open this link within ${RESET_MINUTES} minutes. It works only once:\n\n${ctx.site}/#account/reset/${token}\n\nIf you didn't ask for this, you can ignore this email. Your password has not changed.${FOOTER}`,
      });
    }
    return { ok: true };
  },

  /** The reset screen needs the username (the browser mixes it into the password stretching). */
  'POST /reset-info': async (ctx, body) => {
    await limit(ctx, 'link', clientIP(ctx), 30, 3600);
    const row = await findToken(ctx, str(body, 'token', 100), 'reset', false);
    if (!row) throw new HttpError(400, 'This link has expired or was already used. Please ask for a new one.', 'link');
    const u = await ctx.env.DB.prepare('SELECT username FROM users WHERE id = ?').bind(row.user_id).first<{ username: string }>();
    return { username: u?.username };
  },

  'POST /reset': async (ctx, body) => {
    await limit(ctx, 'link', clientIP(ctx), 30, 3600);
    const pw = clientKey(body);
    const row = await findToken(ctx, str(body, 'token', 100), 'reset', true);
    if (!row) throw new HttpError(400, 'This link has expired or was already used. Please ask for a new one.', 'link');
    const db = ctx.env.DB;
    const user = await db.prepare('SELECT * FROM users WHERE id = ?').bind(row.user_id).first<UserRow>();
    if (!user) throw new HttpError(400, 'This account no longer exists.', 'link');
    await db.batch([
      // a reset link also proves the email is theirs
      db.prepare('UPDATE users SET pw = ?, verified = 1 WHERE id = ?').bind(await hashClientKey(ctx.keys, pw), user.id),
      db.prepare("DELETE FROM tokens WHERE user_id = ? AND kind = 'reset'").bind(user.id),
      // sign out everywhere, in case someone else was signed in
      db.prepare('DELETE FROM sessions WHERE user_id = ?').bind(user.id),
    ]);
    mail(ctx, {
      to: await decryptEmail(ctx.keys, user.email_enc),
      subject: 'Your Ancient Pathfinder password was changed',
      text: `${hello(user)}\n\nThe password for your Ancient Pathfinder account (username: ${user.username}) was just reset, and every device was signed out.\n\nIf this wasn't you, use "Forgot password" on the sign-in screen right away to choose a new one.${FOOTER}`,
    });
    return { ok: true, username: user.username };
  },

  'POST /password': async (ctx, body) => {
    const s = await requireUser(ctx);
    await requirePassword(ctx, s.user, body, 'current');
    const pw = clientKey(body);
    const db = ctx.env.DB;
    await db.batch([
      db.prepare('UPDATE users SET pw = ? WHERE id = ?').bind(await hashClientKey(ctx.keys, pw), s.user.id),
      // other devices are signed out; this one stays signed in
      db.prepare('DELETE FROM sessions WHERE user_id = ? AND id_hash != ?').bind(s.user.id, s.sessionHash),
    ]);
    mail(ctx, {
      to: await decryptEmail(ctx.keys, s.user.email_enc),
      subject: 'Your Ancient Pathfinder password was changed',
      text: `${hello(s.user)}\n\nThe password for your Ancient Pathfinder account (username: ${s.user.username}) was just changed, and your other devices were signed out.\n\nIf this wasn't you, use "Forgot password" on the sign-in screen right away.${FOOTER}`,
    });
    return { ok: true };
  },

  /** Change email: confirmed by a link sent to the new address; the old address is told. */
  'POST /email': async (ctx, body) => {
    const s = await requireUser(ctx);
    await requirePassword(ctx, s.user, body);
    const addr = email(body);
    await limit(ctx, 'email-change', s.user.id, 5, DAY);
    const fp = await emailFingerprint(ctx.keys, addr);
    if (fp === s.user.email_hash) throw new HttpError(400, 'That is already your email address.', 'email');
    const taken = await ctx.env.DB.prepare('SELECT 1 FROM users WHERE email_hash = ?').bind(fp).first();
    if (!taken) {
      await ctx.env.DB.prepare("DELETE FROM tokens WHERE user_id = ? AND kind = 'email'").bind(s.user.id).run();
      const data = JSON.stringify({ enc: await encryptEmail(ctx.keys, addr), hash: fp });
      const token = await newToken(ctx, s.user.id, 'email', EMAIL_CHANGE_MINUTES * 60, data);
      mail(ctx, {
        to: addr,
        subject: 'Confirm your new email for Ancient Pathfinder',
        text: `${hello(s.user)}\n\nTo use this email address for your Ancient Pathfinder account (username: ${s.user.username}), open this link within ${EMAIL_CHANGE_MINUTES} minutes:\n\n${ctx.site}/#account/email/${token}\n\nIf you didn't ask for this, you can ignore this email.${FOOTER}`,
      });
    }
    mail(ctx, {
      to: await decryptEmail(ctx.keys, s.user.email_enc),
      subject: 'A change of email was requested for your Ancient Pathfinder account',
      text: `${hello(s.user)}\n\nSomeone signed in to your Ancient Pathfinder account (username: ${s.user.username}) asked to change its email address. Nothing changes until the new address is confirmed.\n\nIf this wasn't you, change your password right away (or use "Forgot password").${FOOTER}`,
    });
    // the same answer even if the new address belongs to another account
    return { ok: true };
  },

  'POST /email-confirm': async (ctx, body) => {
    await limit(ctx, 'link', clientIP(ctx), 30, 3600);
    const row = await findToken(ctx, str(body, 'token', 100), 'email', true);
    if (!row?.data) throw new HttpError(400, 'This link has expired or was already used.', 'link');
    const { enc, hash } = JSON.parse(row.data) as { enc: string; hash: string };
    if (await ctx.env.DB.prepare('SELECT 1 FROM users WHERE email_hash = ?').bind(hash).first())
      throw new HttpError(409, 'That email address is already used by another account.', 'email');
    await ctx.env.DB.prepare('UPDATE users SET email_enc = ?, email_hash = ?, verified = 1 WHERE id = ?')
      .bind(enc, hash, row.user_id)
      .run();
    return { ok: true };
  },

  'POST /display-name': async (ctx, body) => {
    const s = await requireUser(ctx);
    const display = cleanText(str(body, 'displayName', 100), 40) || null;
    await ctx.env.DB.prepare('UPDATE users SET display_name = ? WHERE id = ?').bind(display, s.user.id).run();
    return { ok: true, displayName: display };
  },

  /** Reading preferences (text size, bolder text, translation, map style): a small JSON object. */
  'POST /prefs': async (ctx, body) => {
    const s = await requireUser(ctx);
    await limit(ctx, 'prefs', s.user.id, 300, 3600);
    const p = body.prefs;
    if (typeof p !== 'object' || p === null || Array.isArray(p)) throw new HttpError(400, 'Invalid preferences.');
    const allowed = ['translation', 'text', 'map'];
    const clean: Record<string, unknown> = {};
    for (const k of allowed) if (k in p) clean[k] = (p as Record<string, unknown>)[k];
    const json = JSON.stringify(clean);
    if (json.length > 4000) throw new HttpError(413, 'Preferences too large.');
    await ctx.env.DB.prepare('UPDATE users SET prefs = ? WHERE id = ?').bind(json, s.user.id).run();
    return { ok: true };
  },

  'GET /bookmarks': async (ctx) => {
    const s = await requireUser(ctx);
    const r = await ctx.env.DB.prepare(
      'SELECT id, ref, label, created_at FROM bookmarks WHERE user_id = ? ORDER BY created_at DESC',
    )
      .bind(s.user.id)
      .all<{ id: string; ref: string; label: string | null; created_at: number }>();
    return { bookmarks: r.results.map((b) => ({ id: b.id, ref: b.ref, label: b.label, createdAt: b.created_at })) };
  },

  'POST /bookmarks': async (ctx, body) => {
    const s = await requireUser(ctx);
    await limit(ctx, 'bookmark', s.user.id, 300, 3600);
    const ref = str(body, 'ref', 20);
    if (!REF_RE.test(ref)) throw new HttpError(400, 'Invalid reference.');
    // a short label in the person's own words (verse wording isn't stored)
    const label = cleanText(str(body, 'label', 200), 80) || null;
    const count = await ctx.env.DB.prepare('SELECT COUNT(*) AS n FROM bookmarks WHERE user_id = ?')
      .bind(s.user.id)
      .first<{ n: number }>();
    if ((count?.n ?? 0) >= MAX_BOOKMARKS) throw new HttpError(400, `You can keep up to ${MAX_BOOKMARKS} bookmarks.`);
    const id = randomToken(12);
    await ctx.env.DB.prepare(
      `INSERT INTO bookmarks (id, user_id, ref, label, created_at) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(user_id, ref) DO UPDATE SET label = excluded.label`,
    )
      .bind(id, s.user.id, ref, label, now())
      .run();
    return { ok: true };
  },

  'POST /bookmarks/delete': async (ctx, body) => {
    const s = await requireUser(ctx);
    const ref = str(body, 'ref', 20);
    await ctx.env.DB.prepare('DELETE FROM bookmarks WHERE user_id = ? AND ref = ?').bind(s.user.id, ref).run();
    return { ok: true };
  },

  // ------------------------------------------------------------------------------------ passkeys

  /** Adding a passkey needs the password again. */
  'POST /passkey/register-options': async (ctx, body) => {
    const s = await requireUser(ctx);
    await requirePassword(ctx, s.user, body);
    const existing = await ctx.env.DB.prepare('SELECT id, transports FROM passkeys WHERE user_id = ?')
      .bind(s.user.id)
      .all<{ id: string; transports: string | null }>();
    if (existing.results.length >= MAX_PASSKEYS) throw new HttpError(400, `You can add up to ${MAX_PASSKEYS} passkeys.`);
    const options = await generateRegistrationOptions({
      rpName: 'Ancient Pathfinder',
      rpID: ctx.rpID,
      userName: s.user.username,
      userID: utf8(s.user.id),
      userDisplayName: s.user.display_name || s.user.username,
      attestationType: 'none',
      excludeCredentials: existing.results.map((p) => ({
        id: p.id,
        transports: p.transports ? JSON.parse(p.transports) : undefined,
      })),
      authenticatorSelection: { residentKey: 'required', userVerification: 'required' },
    });
    const cid = randomToken(16);
    await ctx.env.DB.prepare('INSERT INTO challenges (id, user_id, kind, challenge, expires_at) VALUES (?, ?, ?, ?, ?)')
      .bind(cid, s.user.id, 'reg', options.challenge, now() + 300)
      .run();
    return { options, cid };
  },

  'POST /passkey/register': async (ctx, body) => {
    const s = await requireUser(ctx);
    const ch = await takeChallenge(ctx, str(body, 'cid', 64), 'reg');
    if (!ch || ch.user_id !== s.user.id) throw new HttpError(400, 'That took too long. Please try again.');
    let v;
    try {
      v = await verifyRegistrationResponse({
        response: body.response as Parameters<typeof verifyRegistrationResponse>[0]['response'],
        expectedChallenge: ch.challenge,
        expectedOrigin: ctx.origins,
        expectedRPID: ctx.rpID,
        requireUserVerification: true,
      });
    } catch {
      throw new HttpError(400, 'The passkey couldn\'t be added. Please try again.');
    }
    if (!v.verified) throw new HttpError(400, 'The passkey couldn\'t be added. Please try again.');
    const c = v.registrationInfo.credential;
    const name = cleanText(str(body, 'name', 100), 40) || 'Passkey';
    await ctx.env.DB.prepare(
      'INSERT INTO passkeys (id, user_id, public_key, counter, transports, name, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    )
      .bind(c.id, s.user.id, b64url(c.publicKey), c.counter, c.transports ? JSON.stringify(c.transports) : null, name, now())
      .run();
    mail(ctx, {
      to: await decryptEmail(ctx.keys, s.user.email_enc),
      subject: 'A passkey was added to your Ancient Pathfinder account',
      text: `${hello(s.user)}\n\nA passkey ("${name}") was just added to your Ancient Pathfinder account (username: ${s.user.username}). It lets that device sign in with Face ID, Touch ID or its screen lock.\n\nIf this wasn't you, sign in, remove the passkey on your account page, and change your password.${FOOTER}`,
    });
    return { ok: true };
  },

  'POST /passkey/login-options': async (ctx) => {
    await limit(ctx, 'passkey-ip', clientIP(ctx), 30, 900);
    const options = await generateAuthenticationOptions({ rpID: ctx.rpID, userVerification: 'required' });
    const cid = randomToken(16);
    await ctx.env.DB.prepare('INSERT INTO challenges (id, user_id, kind, challenge, expires_at) VALUES (?, NULL, ?, ?, ?)')
      .bind(cid, 'auth', options.challenge, now() + 300)
      .run();
    return { options, cid };
  },

  'POST /passkey/login': async (ctx, body) => {
    await limit(ctx, 'passkey-ip', clientIP(ctx), 30, 900);
    const ch = await takeChallenge(ctx, str(body, 'cid', 64), 'auth');
    if (!ch) throw new HttpError(400, 'That took too long. Please try again.');
    const response = body.response as Parameters<typeof verifyAuthenticationResponse>[0]['response'];
    const credId = typeof response?.id === 'string' ? response.id.slice(0, 1400) : '';
    const pk = await ctx.env.DB.prepare('SELECT * FROM passkeys WHERE id = ?').bind(credId).first<{
      id: string;
      user_id: string;
      public_key: string;
      counter: number;
      transports: string | null;
    }>();
    const fail = new HttpError(401, 'That passkey isn\'t recognised here. Try your password instead.', 'passkey');
    if (!pk) throw fail;
    let v;
    try {
      v = await verifyAuthenticationResponse({
        response,
        expectedChallenge: ch.challenge,
        expectedOrigin: ctx.origins,
        expectedRPID: ctx.rpID,
        requireUserVerification: true,
        credential: {
          id: pk.id,
          publicKey: fromB64url(pk.public_key),
          counter: pk.counter,
          transports: pk.transports ? JSON.parse(pk.transports) : undefined,
        },
      });
    } catch {
      throw fail;
    }
    if (!v.verified) throw fail;
    const user = await ctx.env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(pk.user_id).first<UserRow>();
    if (!user || !user.verified) throw fail;
    await ctx.env.DB.prepare('UPDATE passkeys SET counter = ?, last_used = ? WHERE id = ?')
      .bind(v.authenticationInfo.newCounter, now(), pk.id)
      .run();
    await startSession(ctx, user.id);
    return { user: await publicUser(ctx, user) };
  },

  'POST /passkey/delete': async (ctx, body) => {
    const s = await requireUser(ctx);
    await ctx.env.DB.prepare('DELETE FROM passkeys WHERE user_id = ? AND id = ?')
      .bind(s.user.id, str(body, 'id', 1400))
      .run();
    return { ok: true };
  },

  // ------------------------------------------------------------------------------ your data

  /** "Download my data": everything stored about the account, in readable form. */
  'GET /export': async (ctx) => {
    const s = await requireUser(ctx);
    const bookmarks = await ctx.env.DB.prepare('SELECT ref, label, created_at FROM bookmarks WHERE user_id = ? ORDER BY created_at')
      .bind(s.user.id)
      .all();
    const me = await publicUser(ctx, s.user);
    return {
      exportedAt: new Date().toISOString(),
      service: 'Ancient Pathfinder (https://ancientpathfinder.com)',
      account: {
        username: me.username,
        displayName: me.displayName,
        email: me.email,
        createdAt: new Date(me.createdAt * 1000).toISOString(),
      },
      preferences: me.prefs,
      bookmarks: bookmarks.results,
      passkeys: me.passkeys.map((p) => ({ name: p.name, createdAt: p.createdAt, lastUsed: p.lastUsed })),
      note: 'Passwords are never stored in readable form, so none is included.',
    };
  },

  /** "Delete my account": erases every row about the person. */
  'POST /delete': async (ctx, body) => {
    const s = await requireUser(ctx);
    await requirePassword(ctx, s.user, body);
    const addr = await decryptEmail(ctx.keys, s.user.email_enc);
    const db = ctx.env.DB;
    const id = s.user.id;
    await db.batch([
      db.prepare('DELETE FROM bookmarks WHERE user_id = ?').bind(id),
      db.prepare('DELETE FROM shares WHERE user_id = ?').bind(id),
      db.prepare('DELETE FROM notes WHERE user_id = ?').bind(id),
      db.prepare('DELETE FROM notebooks WHERE user_id = ?').bind(id),
      db.prepare('DELETE FROM passkeys WHERE user_id = ?').bind(id),
      db.prepare('DELETE FROM tokens WHERE user_id = ?').bind(id),
      db.prepare('DELETE FROM sessions WHERE user_id = ?').bind(id),
      db.prepare('DELETE FROM challenges WHERE user_id = ?').bind(id),
      db.prepare('DELETE FROM users WHERE id = ?').bind(id),
    ]);
    ctx.setCookie.push(sessionCookie(ctx, '', 0));
    mail(ctx, {
      to: addr,
      subject: 'Your Ancient Pathfinder account was deleted',
      text: `${hello(s.user)}\n\nYour Ancient Pathfinder account (username: ${s.user.username}) and everything saved with it have been deleted. We no longer keep your email address; this is the last message you'll get from us.\n\nYou can still use Ancient Pathfinder without an account at any time.${FOOTER}`,
    });
    return { ok: true };
  },

  /**
   * Leaked-password check (Have I Been Pwned, "range" search). The browser sends only the first 5 characters
   * of the password's SHA-1 fingerprint; this passes them on (so HIBP never sees anyone's internet address),
   * and the browser compares the list it gets back on its own. Padding hides the real list size.
   */
  'POST /pwned': async (ctx, body) => {
    await limit(ctx, 'pwned', clientIP(ctx), 60, 3600);
    const prefix = str(body, 'prefix', 5).toUpperCase();
    if (!/^[0-9A-F]{5}$/.test(prefix)) throw new HttpError(400, 'Invalid request.');
    try {
      const r = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
        headers: { 'Add-Padding': 'true', 'User-Agent': 'ancient-pathfinder-accounts' },
        signal: AbortSignal.timeout(4000),
      });
      if (!r.ok) return { available: false };
      return { available: true, list: await r.text() };
    } catch {
      return { available: false };
    }
  },

  /** Testing only (wrangler dev on a computer): the emails that would have been sent. */
  'GET /dev/outbox': async (ctx) => {
    if (!ctx.dev) throw new HttpError(404, 'Not found.');
    const r = await ctx.env.DB.prepare('SELECT * FROM dev_outbox ORDER BY rowid DESC LIMIT 20').all();
    return { mail: r.results };
  },

  ...NOTE_ROUTES,
  ...LESSON_ROUTES,
};

async function takeChallenge(ctx: Ctx, id: string, kind: string) {
  if (!id) return null;
  const row = await ctx.env.DB.prepare('SELECT * FROM challenges WHERE id = ? AND kind = ? AND expires_at > ?')
    .bind(id, kind, now())
    .first<{ id: string; user_id: string | null; challenge: string }>();
  await ctx.env.DB.prepare('DELETE FROM challenges WHERE id = ?').bind(id).run();
  return row;
}
