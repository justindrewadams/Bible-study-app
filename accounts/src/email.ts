/**
 * Sending account emails through Brevo (free plan: 300 a day).
 *
 * Plain text only: no images, no tracking pixel, no rewritten links, and never any Bible wording
 * (the publishers' terms don't allow licensed text in emails).
 */
import type { Env } from './worker';

export interface Mail {
  to: string;
  subject: string;
  text: string;
}

export const SENDER = { name: 'Ancient Pathfinder', email: 'account@ancientpathfinder.com' };

export async function sendEmail(env: Env, dev: boolean, m: Mail): Promise<void> {
  if (dev) {
    // testing on a computer: keep the email in a local table instead of sending it
    await env.DB.prepare('CREATE TABLE IF NOT EXISTS dev_outbox (to_addr TEXT, subject TEXT, body TEXT, at INTEGER)').run();
    await env.DB.prepare('INSERT INTO dev_outbox VALUES (?, ?, ?, ?)').bind(m.to, m.subject, m.text, Date.now()).run();
    return;
  }
  if (!env.BREVO_API_KEY) throw new Error('BREVO_API_KEY is not set');
  const r = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': env.BREVO_API_KEY, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      sender: SENDER,
      to: [{ email: m.to }],
      subject: m.subject,
      textContent: m.text,
      tags: ['account'],
    }),
  });
  if (!r.ok) throw new Error(`Brevo answered ${r.status}`);
}
