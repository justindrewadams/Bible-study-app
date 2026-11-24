# Accounts service (Cloudflare Worker + D1 database)

Optional accounts for Ancient Pathfinder: sign in, confirm/reset by email, passkeys, synced reading
preferences and bookmarks. It is a **separate** Worker from the Bible relay, so a problem here can never stop
Bible text from loading. It runs on Cloudflare's free plan.

- Code: `accounts/src/` → built into `accounts-worker.js` with `npm run build:accounts` (paste that file into
  Cloudflare). Tables: `schema.sql`. App side: `src/lib/account.ts`, `src/components/AccountPanel.tsx`,
  `Turnstile.tsx`, `PrivacyPage.tsx`; switch: `ACCOUNTS_LIVE` in `src/config.ts`.
- Address: **https://account.ancientpathfinder.com** (a sub-address of the app's own domain, so the sign-in
  cookie is first-party and works in Safari).

## How it keeps people safe

| What | How |
|---|---|
| Passwords | Stretched **on the person's device** (PBKDF2-SHA256, 600,000 rounds, salted with the username), then checked here with a secret "pepper" (HMAC). The service never sees a password; the database holds only a check value. (Stretching on the device is what lets this fit Cloudflare's free plan, which allows very little computing per request.) |
| Leaked passwords | Refused at sign-up/reset/change: the device sends the first 5 characters of the password's SHA-1 to `/pwned`, which asks Have I Been Pwned (with padding) and returns the list; the device compares. HIBP never sees the user's internet address. |
| Email addresses | Encrypted (AES-GCM) in the database, plus a keyed one-way fingerprint (HMAC) to find an account for a reset. Only shown to the account's owner. |
| Sign-in | Random cookie, `HttpOnly; Secure; SameSite=Strict`, `__Host-` prefix (only this exact address), 30 days. Only its SHA-256 is stored. |
| Emailed links | Random, single use, stored hashed. Reset **15 minutes**, new email 1 hour, confirming an account 24 hours. A reset signs out every device. |
| Not revealing who has an account | "Forgot password" always gives the same answer; signing up with an email that already has an account gives the normal answer and emails the owner instead. Sign-in says "username or password isn't right" either way. |
| Attacks from other websites | Every request must come from the app's own address (`Origin` check), JSON only (forces a browser pre-check), `SameSite=Strict` cookie. |
| Guessing and bots | Turnstile on sign-up, sign-in and forgot-password; attempt limits (sign-up 5/hour per address, sign-in 10 per 15 min per username and 20 per address, resets 3/hour per email…). Counters use a keyed fingerprint, never the internet address, and expire within a day. |
| Warnings | Emails when the password changes, a passkey is added, or a change of email is requested. |
| Passkeys | WebAuthn (SimpleWebAuthn), Face ID/Touch ID/screen lock required, adding one needs the password again. |
| Your data | "Download my data" (JSON) and "Delete my account" (erases every row at once). Unconfirmed accounts are erased after 24 hours. |
| Your journeys and lists | Stored as notes of kind "journey"/"list" (same encryption and limits): up to 150 stops or items, each checked field by field (a verse is required; journey stops need a map point; notes up to 1,500 characters). |
| Notes and notebooks | Verse notes (5,000 characters), notebook pages (20,000) and notebook/folder names are encrypted with their own key ("notes-enc"). Readable: only which notebook a page is in, its size and dates. Edits carry a version number, so a second device can't silently overwrite newer work. Lists come back unlocked 100 at a time (unlocking costs a little computing time per item, and the free plan allows little per request). Limits: 3,000 items, 6 MB, 300 notebooks and folders. |
| Licensing | No licensed Bible wording is stored or emailed; bookmarks store references only. The app blocks licensed wording in notes before saving (it compares with licensed text in memory, allowing wording that is also in the KJV or WEB); the service can't check, since it never holds licensed text. |

**DATA_KEY is precious.** Every other key is derived from it. If it is lost or changed, every stored email
becomes unreadable and every password stops working. Keep a copy in your password manager. Never put it in the
repository or the website.

## One-time setup (owner, in the browser)

### A. Move ancientpathfinder.com's address settings to Cloudflare (the domain stays registered at Namecheap)
1. <https://dash.cloudflare.com> → **Add a domain** (or *Onboard a domain*) → `ancientpathfinder.com` →
   let it scan the existing records → choose the **Free** plan.
2. Check the records it found. Keep these, each set to **DNS only** (grey cloud, not orange):
   - four **A** records for `ancientpathfinder.com`: 185.199.108.153, 185.199.109.153, 185.199.110.153, 185.199.111.153
   - four **AAAA** records: 2606:50c0:8000::153, 2606:50c0:8001::153, 2606:50c0:8002::153, 2606:50c0:8003::153
   - **CNAME** `www` → `justindrewadams.github.io`
   Delete the **MX** records (`eforward…registrar-servers.com`) and the **TXT** `v=spf1 include:spf.efwd…` record.
   They are for Namecheap's email forwarding, which isn't used.
3. Cloudflare shows **two nameservers** (like `xxx.ns.cloudflare.com`). In Namecheap: **Domain List** →
   **Manage** beside ancientpathfinder.com → **Nameservers** → **Custom DNS** → paste both → ✓ save.
   (If Namecheap's *Advanced DNS* page shows **DNSSEC** switched on, switch it off first.)
4. Wait for Cloudflare's "your domain is now active" email (minutes, sometimes up to a day). The site keeps
   working the whole time. Check it still opens, and that GitHub → Settings → Pages still says the domain is fine.

### B. The database
1. Cloudflare → **Storage & databases** → **D1 SQL database** → **Create** → name `ancientpathfinder-accounts`.
2. Open it → **Console** → paste the whole of [`schema.sql`](./schema.sql) → **Execute**.

### C. The account service (Worker)
1. **Workers & Pages** → **Create** → **Start with Hello World!** → name `ancientpathfinder-accounts` → **Deploy**.
2. **Edit code** → delete everything → paste the whole of [`accounts-worker.js`](./accounts-worker.js) → **Deploy**.
3. **Settings** → **Bindings** → **Add** → **D1 database** → variable name `DB` → choose `ancientpathfinder-accounts` → save.
4. **Settings** → **Domains & Routes** → **Add** → **Custom domain** → `account.ancientpathfinder.com` → add.
   (Needs step A to be finished.) You may also turn off the `workers.dev` address there; it isn't used.

### D. The "verify you are human" check (Turnstile)
1. Cloudflare → **Turnstile** → **Add widget** → name `Ancient Pathfinder accounts`, hostnames
   `ancientpathfinder.com` and `www.ancientpathfinder.com`, mode **Managed** → create.
2. It shows a **site key** (public; send it to Claude, it goes in the app) and a **secret key** (step F).

### E. Email sending (Brevo, free plan)
1. Sign up at <https://www.brevo.com> (free plan).
2. **Senders, domains & dedicated IPs** → **Domains** → **Add a domain** → `ancientpathfinder.com` →
   authenticate it. Brevo can add the records to Cloudflare for you, or shows them to add under
   Cloudflare → DNS → Records (DKIM, the Brevo code, and DMARC). Leave them **DNS only**.
3. **Senders** → add `account@ancientpathfinder.com`, name **Ancient Pathfinder**.
4. If Brevo offers open/click **tracking** for transactional email, turn it off. (The app sends plain text, so
   there is nothing to track anyway.)
5. **SMTP & API** → **API keys** → **Generate a new API key** → copy it (step F). If Brevo offers to restrict
   the key to "authorized IPs", leave that off: Cloudflare's addresses change.

### F. Secrets (Worker → Settings → Variables and Secrets → Add → type **Secret**)
| Name | Value |
|---|---|
| `DATA_KEY` | 32 random bytes. On the Mac, open **Terminal** and run `openssl rand -base64 32`, copy the line it prints, paste it here, and **also save it in your password manager**. |
| `TURNSTILE_SECRET` | the Turnstile **secret key** from step D |
| `BREVO_API_KEY` | the Brevo API key from step E |

Deploy if asked. Then tell Claude the Turnstile **site key**; Claude sets `TURNSTILE_SITE_KEY` and
`ACCOUNTS_LIVE = true` in `src/config.ts` and pushes, and you test sign-up on your phone together.

**Check from the Mac:** `curl -H "Origin: https://ancientpathfinder.com" https://account.ancientpathfinder.com/me`
should answer `{"error":"Please sign in again.","code":"signed-out"}`.

## Changing it later
Edit `accounts/src/`, run `npm run check:accounts && npm run build:accounts`, test locally (below), commit, and
the owner re-pastes `accounts-worker.js` into the Worker editor. A schema change needs a new statement run in
the D1 console. Don't change the password stretching (rounds, salt text) without a migration: existing
passwords would stop working.

**Testing on a computer** (no Cloudflare account needed): `wrangler` 4 (`npm i wrangler` in a scratch folder,
Node 22.12+), then in `accounts/`:
`wrangler d1 execute ancientpathfinder-accounts --local --persist-to <dir> --file=schema.sql` and
`wrangler dev --port 8787 --persist-to <dir> --var DATA_KEY:<random base64> --var TURNSTILE_SECRET:1x0000000000000000000000000000000AA`.
`wrangler.toml` sets `DEV=1`, which only works on localhost: emails go to a local table (`GET /dev/outbox`)
instead of Brevo. Build the app with `VITE_ACCOUNTS_URL=http://localhost:8787 VITE_TURNSTILE_SITE_KEY=1x00000000000000000000AA`
(Cloudflare's always-pass test key) and preview it on port 4173.

## If something goes wrong (incident checklist)
1. **Switch accounts off:** Worker → Settings → Variables → add a plain variable `ACCOUNTS_OFF` = `1` → deploy.
   The app keeps working; sign-in says it's unavailable. (Or set `ACCOUNTS_LIVE = false` in the app.)
2. **Sign everyone out:** D1 console → `DELETE FROM sessions;`
3. **A leaked Brevo or Turnstile key:** create a new one, replace the secret, delete the old one.
4. **Possible exposure of the database:** emails are encrypted and passwords are never stored, so a copy of
   the database alone reveals neither. If `DATA_KEY` may also have leaked, treat emails as exposed.
5. **Tell the people affected** by email as soon as possible: what happened, what it means, what to do (change
   password). Ask Claude to add a one-time "notice" route that emails every account, then remove it.
6. Write down what happened and when, in HANDOFF.md.

## Removing accounts entirely
Warn users in the app first, so they have time to use "Download my data". Then delete the Worker and the D1 database
in Cloudflare, delete the Brevo account, and set `ACCOUNTS_LIVE = false`.
