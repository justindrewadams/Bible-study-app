-- Ancient Pathfinder accounts: database tables (Cloudflare D1).
-- Paste this whole file into the database's Console in the Cloudflare dashboard once.
-- It is safe to run again: it only creates what is missing.
--
-- What is NOT here, on purpose: readable email addresses (only locked/encrypted copies and a one-way
-- fingerprint), passwords (only a one-way check value), internet addresses, Bible wording.

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,                -- random id
  username TEXT NOT NULL UNIQUE,      -- lower case, chosen by the person
  display_name TEXT,                  -- optional nickname
  email_enc TEXT NOT NULL,            -- email, encrypted (AES-GCM)
  email_hash TEXT NOT NULL UNIQUE,    -- one-way fingerprint of the email, to find the account for a reset
  verified INTEGER NOT NULL DEFAULT 0,
  pw TEXT NOT NULL,                   -- one-way password check value
  prefs TEXT,                         -- JSON: text size, translation, map style
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id_hash TEXT PRIMARY KEY,           -- SHA-256 of the sign-in cookie (the cookie itself is never stored)
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS tokens (
  token_hash TEXT PRIMARY KEY,        -- SHA-256 of an emailed link's code
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,                 -- verify | reset | email
  data TEXT,                          -- for "email": the new address, encrypted, and its fingerprint
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS tokens_user ON tokens(user_id);

CREATE TABLE IF NOT EXISTS passkeys (
  id TEXT PRIMARY KEY,                -- the passkey's credential id
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  public_key TEXT NOT NULL,           -- public half only; the private half never leaves the person's device
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
  kind TEXT NOT NULL,                 -- reg | auth
  challenge TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS bookmarks (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ref TEXT NOT NULL,                  -- a reference such as "John.3.16" (never verse wording)
  label TEXT,
  created_at INTEGER NOT NULL,
  UNIQUE (user_id, ref)
);

CREATE TABLE IF NOT EXISTS rate (
  key TEXT PRIMARY KEY,               -- keyed fingerprint of (action, internet address or account); expires within a day
  n INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
