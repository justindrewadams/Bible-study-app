/**
 * Privacy & terms (#privacy). Plain-language, written for this app; the owner approves changes.
 * Keep it in step with what the account service (accounts/) really does.
 */
import { PRIVACY_CONTACT } from '../config';

const UPDATED = '24 November 2026';

export default function PrivacyPage({ onClose }: { onClose: () => void }) {
  return (
    <div className="periods-page privacy-page">
      <div className="periods-bar">
        <button className="bar-back" onClick={onClose}>
          ‹ Back to reading
        </button>
        <span className="bar-title">Privacy & terms</span>
      </div>
      <div className="periods-inner privacy-inner">
        <h1>Privacy & terms</h1>
        <p className="muted small">Last updated {UPDATED}</p>
        <p>
          Ancient Pathfinder is a free Bible study app with no ads, no fees and no donations. You can use all of it
          without an account. An account only saves your bookmarks and reading preferences, and keeps them the same on
          your devices. This page explains, in plain words, what we keep and why.
        </p>

        <h2>What we keep if you create an account</h2>
        <ul>
          <li>
            <strong>Your username</strong> and, if you choose one, a <strong>display name</strong> (any nickname).
          </li>
          <li>
            <strong>Your email address</strong>, only to confirm your account, reset your password, and tell you about
            important changes to your account (such as a new password or passkey). It is stored locked (encrypted), is
            never shown to anyone else, never shared or sold, and never used for newsletters or marketing.
          </li>
          <li>
            <strong>A check value for your password</strong>, never the password itself. Your device scrambles the
            password before it is sent, and our service scrambles it again with a secret key, so nobody (including us)
            can read it.
          </li>
          <li>
            <strong>Passkeys</strong> you add: only the public half, which can't be used to sign in on its own. Face ID,
            fingerprints and screen locks never leave your device.
          </li>
          <li>
            <strong>Your preferences</strong> (text size, bolder text, translation, map style) and{' '}
            <strong>bookmarks</strong> (Bible references such as “John 3:16” and any short label you add).
          </li>
          <li>
            <strong>A sign-in cookie</strong> on your device so you stay signed in for up to 30 days. It is used only for
            signing in, never for tracking or ads.
          </li>
        </ul>

        <h2>What we don't keep</h2>
        <ul>
          <li>Your real name, address, phone number, birthday, location or payment details.</li>
          <li>
            Your internet address. To stop people from guessing passwords, we briefly count attempts using a scrambled
            fingerprint of the address. Those counts are erased within a day.
          </li>
          <li>Bible text. Bookmarks store references only; the wording is loaded fresh each time you read.</li>
          <li>Anything about what you read when you aren't signed in.</li>
        </ul>

        <h2>Who helps run accounts</h2>
        <ul>
          <li>
            <strong>Cloudflare</strong> runs the account service and its database, and the “verify you are human” check
            (Turnstile) on the account forms. Turnstile looks at basic browser signals to tell people from bots;
            Cloudflare says it doesn't use them for ads or to track you across websites.
          </li>
          <li>
            <strong>Brevo</strong> sends the account emails (plain text, without tracking pixels). It sees your email
            address and the message when sending, and keeps its own sending records as its privacy policy describes.
          </li>
          <li>
            <strong>Have I Been Pwned</strong> helps refuse passwords that have leaked in other websites' data breaches.
            It receives only the first five characters of a scrambled form of the new password, through our service, so
            it never sees your password, email, username or internet address.
          </li>
          <li>
            The rest of the app works as before: GitHub Pages hosts the website; Bible text comes from Crossway (ESV),
            API.Bible (NASB 1995, CSB, NKJV, which counts anonymous views for its publishers) and bible-api.com; maps from
            Esri and OpenStreetMap; place histories from Wikipedia. See “Sources & licenses” (⚙) for details.
          </li>
        </ul>

        <h2>How long we keep it</h2>
        <ul>
          <li>Until you delete your account. “Delete my account” erases it right away.</li>
          <li>An account that is never confirmed is erased after 24 hours.</li>
          <li>Emailed links stop working after one use, or after 15 minutes (password reset), one hour (new email) or 24 hours (confirming a new account).</li>
          <li>
            Cloudflare keeps automatic database backups for a short time (up to 30 days) so the service can be restored
            after a fault; deleted accounts drop out of those backups as they expire.
          </li>
        </ul>

        <h2>Your choices</h2>
        <ul>
          <li>
            <strong>See your data:</strong> “Download my data” on your account page gives you everything we keep about
            you.
          </li>
          <li>
            <strong>Change it:</strong> your display name, email, password and passkeys can be changed on your account
            page.
          </li>
          <li>
            <strong>Delete it:</strong> “Delete my account” erases everything at once.
          </li>
          {PRIVACY_CONTACT && (
            <li>
              <strong>Questions:</strong> write to <a href={`mailto:${PRIVACY_CONTACT}`}>{PRIVACY_CONTACT}</a>.
            </li>
          )}
        </ul>

        <h2>Children</h2>
        <p>
          You must be 13 or older to create an account. Anyone may use the app without an account. If we learn that an
          account belongs to someone under 13, we will delete it.
        </p>

        <h2>If something goes wrong</h2>
        <p>
          If we ever learn that account information may have been exposed, we will email the people affected as soon as
          we can, say what happened and what to do, and switch accounts off until it is fixed. Because emails are stored
          locked and passwords are never stored, a copy of the database alone would not reveal either.
        </p>

        <h1 className="privacy-terms-title">Terms</h1>
        <ul>
          <li>Ancient Pathfinder is free and non-commercial. Please use it for personal study, teaching and sharing the Bible.</li>
          <li>Keep your password to yourself, and one account per person.</li>
          <li>
            Bookmark labels (and, later, notes and lessons) should be in your own words. Please don't paste in the wording
            of copyrighted Bible translations (ESV, NASB, CSB, NKJV and others); their publishers don't allow it to be
            stored or shared that way. Public-domain wording (KJV, WEB, ASV) is fine.
          </li>
          <li>Don't try to break into accounts, overload the service, or use it to harm others.</li>
          <li>
            We may remove content or accounts that break these terms, and we may change or end the service. If accounts
            ever end, we'll say so in the app first, and you can download your data.
          </li>
          <li>
            The app is offered as is, without warranty. Place identifications, dates and maps are best estimates and may
            be uncertain.
          </li>
          <li>Bible translations remain the property of their publishers; see “Sources & licenses” (⚙).</li>
        </ul>
        <p>
          <button className="btn" onClick={onClose}>
            ‹ Back to reading
          </button>
        </p>
      </div>
    </div>
  );
}
