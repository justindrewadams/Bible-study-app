/**
 * The app's side of accounts: talking to the account service, the signed-in state, password stretching,
 * the leaked-password check, and bookmarks. The service itself is in accounts/ (see accounts/README.md).
 *
 * Nothing here runs for people who never sign in: the service is only contacted once someone opens the
 * account panel, or when this device remembers having signed in ("acct" in localStorage, no personal data).
 */
import { useSyncExternalStore } from 'react';
import { ACCOUNTS_ENABLED, ACCOUNTS_URL } from '../config';

export interface Passkey {
  id: string;
  name: string | null;
  createdAt: number;
  lastUsed: number | null;
}

export interface SyncedPrefs {
  translation?: string;
  text?: { size: number; bold: boolean };
  map?: Record<string, unknown>;
}

export interface AccountUser {
  username: string;
  displayName: string | null;
  email: string;
  createdAt: number;
  prefs: SyncedPrefs | null;
  passkeys: Passkey[];
}

export interface Bookmark {
  id: string;
  ref: string;
  label: string | null;
  createdAt: number;
}

export class AccountError extends Error {
  constructor(
    message: string,
    public code?: string,
    public status?: number,
    /** the whole answer, for errors that carry more (e.g. the newer copy of a note) */
    public body?: Record<string, unknown>,
  ) {
    super(message);
  }
}

export async function api<T = { ok: true }>(path: string, body?: unknown): Promise<T> {
  let r: Response;
  try {
    r = await fetch(ACCOUNTS_URL + path, {
      method: body === undefined ? 'GET' : 'POST',
      credentials: 'include',
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new AccountError("Couldn't reach the account service. Check your connection and try again.", 'network');
  }
  const j = (await r.json().catch(() => ({}))) as { error?: string; code?: string };
  if (!r.ok) {
    if (r.status === 401 && j.code === 'signed-out') setSignedOut();
    throw new AccountError(j.error || 'Something went wrong. Please try again.', j.code, r.status, j as Record<string, unknown>);
  }
  return j as T;
}

// ------------------------------------------------------------------------------- signed-in state

interface State {
  status: 'unknown' | 'signed-out' | 'signed-in';
  user: AccountUser | null;
  bookmarks: Bookmark[];
}

const FLAG = 'acct';
let state: State = { status: 'unknown', user: null, bookmarks: [] };
const listeners = new Set<() => void>();
const emit = (next: Partial<State>) => {
  state = { ...state, ...next };
  listeners.forEach((l) => l());
};

export function useAccount(): State {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
  );
}

export function getAccount() {
  return state;
}

/** Be told whenever the signed-in state changes (used by notes to forget everything on sign-out). */
export function onAccountChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function setFlag(on: boolean) {
  try {
    if (on) localStorage.setItem(FLAG, '1');
    else localStorage.removeItem(FLAG);
  } catch {
    /* ignore */
  }
}

export function setSignedIn(user: AccountUser) {
  setFlag(true);
  emit({ status: 'signed-in', user });
  refreshBookmarks();
}

export function setSignedOut() {
  setFlag(false);
  emit({ status: 'signed-out', user: null, bookmarks: [] });
}

export function updateUser(patch: Partial<AccountUser>) {
  if (state.user) emit({ user: { ...state.user, ...patch } });
}

/** On start-up: only if this device has signed in before, ask who is signed in. */
export async function initAccount() {
  if (!ACCOUNTS_ENABLED) return;
  let flagged = false;
  try {
    flagged = localStorage.getItem(FLAG) === '1';
  } catch {
    /* ignore */
  }
  if (!flagged) return emit({ status: 'signed-out' });
  await reloadMe();
}

export async function reloadMe() {
  try {
    const { user } = await api<{ user: AccountUser }>('/me');
    setSignedIn(user);
  } catch (e) {
    if (e instanceof AccountError && e.code === 'network') emit({ status: 'signed-out' });
    else setSignedOut();
  }
}

export async function signOut(everywhere = false) {
  try {
    await api(everywhere ? '/logout-all' : '/logout', {});
  } finally {
    setSignedOut();
  }
}

// ---------------------------------------------------------------------------------------- bookmarks

export async function refreshBookmarks() {
  try {
    const { bookmarks } = await api<{ bookmarks: Bookmark[] }>('/bookmarks');
    emit({ bookmarks });
  } catch {
    /* shown as empty */
  }
}

export async function addBookmark(ref: string, label?: string) {
  // shown at once; the list is reloaded from the service afterwards
  if (!state.bookmarks.some((b) => b.ref === ref))
    emit({ bookmarks: [{ id: 'new', ref, label: label ?? null, createdAt: Date.now() / 1000 }, ...state.bookmarks] });
  try {
    await api('/bookmarks', { ref, label });
  } finally {
    refreshBookmarks();
  }
}

export async function removeBookmark(ref: string) {
  emit({ bookmarks: state.bookmarks.filter((b) => b.ref !== ref) });
  try {
    await api('/bookmarks/delete', { ref });
  } finally {
    refreshBookmarks();
  }
}

// --------------------------------------------------------------------------- password handling

const te = new TextEncoder();
const b64url = (buf: ArrayBuffer) =>
  btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

/**
 * Stretch the password on this device before it is sent (PBKDF2-SHA256, 600,000 rounds, salted with the
 * username). The service only ever receives this 32-byte key, never the password, and checks it with its
 * own secret. The username can't be changed, because it is part of this.
 */
export async function passwordKey(username: string, password: string): Promise<string> {
  const base = await crypto.subtle.importKey('raw', te.encode(password.normalize('NFKC')), 'PBKDF2', false, [
    'deriveBits',
  ]);
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt: te.encode(`ancientpathfinder.com|v1|${username.trim().toLowerCase()}`),
      iterations: 600_000,
    },
    base,
    256,
  );
  return b64url(bits);
}

/**
 * Has this password appeared in a known data breach? Only the first 5 characters of its SHA-1 fingerprint
 * leave the device (through the account service, so Have I Been Pwned never sees who is asking); the
 * matching happens here. Returns null when the check isn't available right now.
 */
export async function timesLeaked(password: string): Promise<number | null> {
  const hex = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-1', te.encode(password))))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
  try {
    const r = await api<{ available: boolean; list?: string }>('/pwned', { prefix: hex.slice(0, 5) });
    if (!r.available || !r.list) return null;
    const suffix = hex.slice(5);
    for (const line of r.list.split('\n')) {
      const [s, n] = line.trim().split(':');
      if (s === suffix) return Number(n) || 0; // padding lines have a count of 0
    }
    return 0;
  } catch {
    return null;
  }
}

/** Our own rules for a new password; returns a plain-language problem, or null if it's fine. */
export async function passwordProblem(password: string, username: string, email = ''): Promise<string | null> {
  if (password.length < 10) return 'Please use at least 10 characters. A few unrelated words together works well.';
  if (password.length > 128) return 'Please use at most 128 characters.';
  const p = password.toLowerCase();
  if (username && p.includes(username.toLowerCase())) return "Please don't include your username in your password.";
  const local = email.split('@')[0]?.toLowerCase();
  if (local && local.length >= 4 && p.includes(local)) return "Please don't include your email in your password.";
  if (/^(.)\1+$/.test(password)) return 'Please choose a less predictable password.';
  const leaked = await timesLeaked(password);
  if (leaked && leaked > 0)
    return 'This password has appeared in a known data breach elsewhere, so it isn\'t safe to use. Please choose another.';
  return null;
}

/** Usernames: 3 to 30 letters or numbers, plus . _ - (not at the start). */
export const USERNAME_RE = /^[a-z0-9][a-z0-9_.-]{2,29}$/;
