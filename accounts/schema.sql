/* Ancient Pathfinder accounts: database tables (Cloudflare D1).
   Paste this whole file into the database's Console in the Cloudflare dashboard once. It is safe to run again.
   Not stored, on purpose: readable email addresses (only encrypted copies and a one-way fingerprint),
   passwords (only a one-way check value), internet addresses, Bible wording.
   Columns: users.email_enc = email, encrypted (AES-GCM); users.email_hash = keyed one-way fingerprint;
   users.pw = one-way password check value; sessions.id_hash = SHA-256 of the sign-in cookie;
   tokens.token_hash = SHA-256 of an emailed link's code (kind: verify, reset, email);
   passkeys.public_key = public half only; bookmarks.ref = a reference such as "John.3.16";
   rate.key = keyed fingerprint of an action and address/account, expiring within a day. */

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  display_name TEXT,
  email_enc TEXT NOT NULL,
  email_hash TEXT NOT NULL UNIQUE,
  verified INTEGER NOT NULL DEFAULT 0,
  pw TEXT NOT NULL,
  prefs TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS tokens (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  data TEXT,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS tokens_user ON tokens(user_id);

CREATE TABLE IF NOT EXISTS passkeys (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  public_key TEXT NOT NULL,
  counter INTEGER NOT NULL DEFAULT 0,
  transports TEXT,
  name TEXT,
  created_at INTEGER NOT NULL,
  last_used INTEGER
);
CREATE INDEX IF NOT EXISTS passkeys_user ON passkeys(user_id);

CREATE TABLE IF NOT EXISTS challenges (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  kind TEXT NOT NULL,
  challenge TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS bookmarks (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ref TEXT NOT NULL,
  label TEXT,
  created_at INTEGER NOT NULL,
  UNIQUE (user_id, ref)
);

CREATE TABLE IF NOT EXISTS rate (
  key TEXT PRIMARY KEY,
  n INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
