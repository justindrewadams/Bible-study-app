/**
 * Public app settings. Nothing here is secret: the ESV key lives only in the Cloudflare
 * relay (see relay/README.md), never in this repository or the website.
 */

/**
 * Web address of the ESV relay (a Cloudflare Worker), e.g.
 * "https://bible-atlas-esv.yourname.workers.dev". Leave empty until the relay is set up;
 * until then readers can add their own key in Settings, or see the WEB.
 */
export const ESV_RELAY_URL = 'https://bible-atlas-esv.justindrewadams.workers.dev';

/**
 * Offer the NASB 1995, CSB and NKJV (API.Bible, through the relay above). Turn on once the relay has
 * its API_BIBLE_KEY secret and ABIBLE_STORE KV binding (see relay/README.md).
 */
export const APIBIBLE_ENABLED = true;

/**
 * Accounts (sign-in, synced preferences, bookmarks): a separate Cloudflare Worker with a D1 database,
 * at its own address under the app's domain so its sign-in cookie stays first-party (see accounts/README.md).
 * Off until the owner has set it up; while off, nothing about accounts appears in the app.
 * (VITE_ACCOUNTS_URL / VITE_TURNSTILE_SITE_KEY override these when testing on a computer.)
 */
export const ACCOUNTS_URL: string = import.meta.env.VITE_ACCOUNTS_URL || 'https://account.ancientpathfinder.com';
/** Turn on once the account service, its database, Brevo and Turnstile are set up (accounts/README.md). */
const ACCOUNTS_LIVE = false;
export const ACCOUNTS_ENABLED: boolean = ACCOUNTS_LIVE || !!import.meta.env.VITE_ACCOUNTS_URL;

/** Cloudflare Turnstile site key (public, not a secret): the "verify you are human" check on account forms. */
export const TURNSTILE_SITE_KEY: string = import.meta.env.VITE_TURNSTILE_SITE_KEY || '';

/** An email address for privacy questions, shown on the Privacy & terms page. Empty = not shown. */
export const PRIVACY_CONTACT = '';
