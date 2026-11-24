/**
 * Small cryptography helpers for the account service (Web Crypto only, no libraries).
 *
 * Every key is derived from ONE secret, DATA_KEY (32 random bytes, base64), with HKDF:
 *  - "email-enc"    AES-GCM key that locks email addresses in the database
 *  - "notes-enc"    AES-GCM key that locks notes, notebook pages and notebook names
 *  - "email-lookup" HMAC key for a one-way fingerprint of each email (to find an account by email)
 *  - "pepper"       HMAC key mixed into every stored password check
 *  - "rate"         HMAC key for the short-lived attempt counters (so no internet address is stored)
 * Changing DATA_KEY would make every email unreadable and every password wrong: never change it.
 */

const te = new TextEncoder();
const td = new TextDecoder();

export const utf8 = (s: string) => te.encode(s);

export function b64url(bytes: ArrayBuffer | Uint8Array): string {
  const u = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = '';
  for (let i = 0; i < u.length; i++) s += String.fromCharCode(u[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function fromB64url(s: string): Uint8Array {
  const b = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4);
  const bin = atob(b);
  const u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return u;
}

export function randomToken(bytes = 32): string {
  return b64url(crypto.getRandomValues(new Uint8Array(bytes)));
}

export async function sha256(s: string): Promise<string> {
  return b64url(await crypto.subtle.digest('SHA-256', utf8(s)));
}

export interface Keys {
  emailEnc: CryptoKey;
  notesEnc: CryptoKey;
  emailLookup: CryptoKey;
  pepper: CryptoKey;
  rate: CryptoKey;
}

let cached: { secret: string; keys: Promise<Keys> } | null = null;

export function keysFor(secret: string): Promise<Keys> {
  if (cached?.secret === secret) return cached.keys;
  const keys = (async () => {
    const raw = fromB64url(secret.trim().replace(/=+$/, ''));
    if (raw.length < 32) throw new Error('DATA_KEY must be at least 32 random bytes (base64)');
    const master = await crypto.subtle.importKey('raw', raw, 'HKDF', false, ['deriveKey']);
    const hkdf = (info: string) => ({ name: 'HKDF', hash: 'SHA-256', salt: utf8('ancient-pathfinder-accounts'), info: utf8(info) });
    const hmac = (info: string) =>
      crypto.subtle.deriveKey(hkdf(info), master, { name: 'HMAC', hash: 'SHA-256', length: 256 }, false, ['sign']);
    return {
      emailEnc: await crypto.subtle.deriveKey(hkdf('email-enc'), master, { name: 'AES-GCM', length: 256 }, false, [
        'encrypt',
        'decrypt',
      ]),
      notesEnc: await crypto.subtle.deriveKey(hkdf('notes-enc'), master, { name: 'AES-GCM', length: 256 }, false, [
        'encrypt',
        'decrypt',
      ]),
      emailLookup: await hmac('email-lookup'),
      pepper: await hmac('pepper'),
      rate: await hmac('rate'),
    };
  })();
  cached = { secret, keys };
  return keys;
}

export async function hmac(key: CryptoKey, data: string | Uint8Array): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, typeof data === 'string' ? utf8(data) : data));
}

/** Lock a piece of text with AES-GCM: "v1:<iv>:<ciphertext>". */
export async function encryptText(key: CryptoKey, text: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, utf8(text));
  return `v1:${b64url(iv)}:${b64url(ct)}`;
}

export async function decryptText(key: CryptoKey, stored: string): Promise<string> {
  const [v, iv, ct] = stored.split(':');
  if (v !== 'v1') throw new Error('unknown format');
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64url(iv) }, key, fromB64url(ct));
  return td.decode(pt);
}

export const encryptEmail = (keys: Keys, email: string) => encryptText(keys.emailEnc, email);
export const decryptEmail = (keys: Keys, stored: string) => decryptText(keys.emailEnc, stored);

/** One-way fingerprint of an email, used to find an account by email without storing it readably. */
export async function emailFingerprint(keys: Keys, email: string): Promise<string> {
  return b64url(await hmac(keys.emailLookup, email));
}

/**
 * Stored password check: "s1$<salt>$<HMAC(pepper, salt || clientKey)>".
 * The browser has already stretched the password (PBKDF2-SHA256, 600,000 rounds, see src/lib/account.ts),
 * so what arrives here is a 32-byte key, never the password itself.
 */
export async function hashClientKey(keys: Keys, clientKey: string, salt?: Uint8Array): Promise<string> {
  const s = salt ?? crypto.getRandomValues(new Uint8Array(16));
  const k = fromB64url(clientKey);
  const buf = new Uint8Array(s.length + k.length);
  buf.set(s);
  buf.set(k, s.length);
  return `s1$${b64url(s)}$${b64url(await hmac(keys.pepper, buf))}`;
}

export async function checkClientKey(keys: Keys, clientKey: string, stored: string): Promise<boolean> {
  const [v, salt] = stored.split('$');
  if (v !== 's1' || !salt) return false;
  const again = await hashClientKey(keys, clientKey, fromB64url(salt));
  return timingSafeEqual(utf8(again), utf8(stored));
}

export function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}
