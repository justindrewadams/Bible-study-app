/**
 * Sharing class lessons by link.
 *
 * A lesson is a note of kind "lesson" (see notes.ts). Sharing it gives it a random, unguessable link code;
 * anyone with the link can read the lesson (no account needed), always in its latest version, until the
 * owner stops sharing. The link carries only the code, never Bible wording. Your own journeys and lists that
 * a lesson uses are included for viewers.
 *
 * Because anyone with an account may share, readers can report a lesson (an email goes to the site's
 * administrators, the usernames in ADMIN_USERNAMES), and administrators can take any shared lesson down.
 */
import { decryptEmail, decryptText, randomToken } from './crypto';
import { clientIP, HttpError, isAdmin, limit, mail, now, requireUser, str, turnstile, type Route } from './worker';

const SHARE_RE = /^[A-Za-z0-9_-]{22}$/;

interface ShareRow {
  id: string;
  user_id: string;
  note_id: string;
  show_name: number;
  created_at: number;
}

export const LESSON_ROUTES: Record<string, Route> = {
  /** Your shared lessons: which of your lessons have a link, and whether your name shows. */
  'GET /lessons/shares': async (ctx) => {
    const s = await requireUser(ctx);
    const r = await ctx.env.DB.prepare('SELECT id, note_id, show_name FROM shares WHERE user_id = ?')
      .bind(s.user.id)
      .all<{ id: string; note_id: string; show_name: number }>();
    return { shares: r.results.map((x) => ({ shareId: x.id, noteId: x.note_id, showName: !!x.show_name })) };
  },

  /** Share a lesson (or change whether your display name shows). Returns the link code. */
  'POST /lessons/share': async (ctx, body) => {
    const s = await requireUser(ctx);
    await limit(ctx, 'share', s.user.id, 60, 3600);
    const noteId = str(body, 'noteId', 40);
    const showName = body.showName === true ? 1 : 0;
    const db = ctx.env.DB;
    const note = await db.prepare("SELECT id FROM notes WHERE id = ? AND user_id = ? AND kind = 'lesson'").bind(noteId, s.user.id).first();
    if (!note) throw new HttpError(404, 'That lesson no longer exists.');
    const existing = await db.prepare('SELECT id FROM shares WHERE note_id = ? AND user_id = ?').bind(noteId, s.user.id).first<{ id: string }>();
    if (existing) {
      await db.prepare('UPDATE shares SET show_name = ? WHERE id = ?').bind(showName, existing.id).run();
      return { shareId: existing.id, showName: !!showName };
    }
    const count = await db.prepare('SELECT COUNT(*) AS n FROM shares WHERE user_id = ?').bind(s.user.id).first<{ n: number }>();
    if ((count?.n ?? 0) >= 200) throw new HttpError(400, 'You can share up to 200 lessons.');
    const id = randomToken(16); // 22 characters
    await db
      .prepare('INSERT INTO shares (id, user_id, note_id, show_name, created_at) VALUES (?, ?, ?, ?, ?)')
      .bind(id, s.user.id, noteId, showName, now())
      .run();
    return { shareId: id, showName: !!showName };
  },

  /** Stop sharing: the link stops working straight away. */
  'POST /lessons/unshare': async (ctx, body) => {
    const s = await requireUser(ctx);
    await ctx.env.DB.prepare('DELETE FROM shares WHERE note_id = ? AND user_id = ?').bind(str(body, 'noteId', 40), s.user.id).run();
    return { ok: true };
  },

  /** Open a shared lesson (anyone with the link): GET /shared?id=<code>. */
  'GET /shared': async (ctx) => {
    await limit(ctx, 'shared-ip', clientIP(ctx), 300, 3600);
    const id = new URL(ctx.req.url).searchParams.get('id') ?? '';
    if (!SHARE_RE.test(id)) throw new HttpError(404, 'This lesson link isn’t valid.', 'gone');
    const db = ctx.env.DB;
    const share = await db.prepare('SELECT * FROM shares WHERE id = ?').bind(id).first<ShareRow>();
    const fail = new HttpError(404, 'This lesson is no longer shared.', 'gone');
    if (!share) throw fail;
    const note = await db
      .prepare("SELECT data, updated_at FROM notes WHERE id = ? AND user_id = ? AND kind = 'lesson'")
      .bind(share.note_id, share.user_id)
      .first<{ data: string; updated_at: number }>();
    if (!note) throw fail;
    const lesson = JSON.parse(await decryptText(ctx.keys.notesEnc, note.data)) as {
      title: string;
      summary: string;
      steps: { type: string; source?: string; id?: string }[];
    };
    // the sharer's own journeys and lists that the lesson uses
    const mineIds = [...new Set(lesson.steps.filter((x) => (x.type === 'journey' || x.type === 'list') && x.source === 'mine').map((x) => x.id!))].slice(0, 30);
    const extras: Record<string, unknown>[] = [];
    if (mineIds.length) {
      const marks = mineIds.map(() => '?').join(',');
      const r = await db
        .prepare(`SELECT id, kind, data FROM notes WHERE user_id = ? AND kind IN ('journey','list') AND id IN (${marks})`)
        .bind(share.user_id, ...mineIds)
        .all<{ id: string; kind: string; data: string }>();
      for (const x of r.results) extras.push({ id: x.id, kind: x.kind, ...JSON.parse(await decryptText(ctx.keys.notesEnc, x.data)) });
    }
    let author: string | null = null;
    if (share.show_name) {
      const u = await db.prepare('SELECT display_name, username FROM users WHERE id = ?').bind(share.user_id).first<{ display_name: string | null; username: string }>();
      author = u?.display_name || u?.username || null;
    }
    return { id, title: lesson.title, summary: lesson.summary, steps: lesson.steps, author, updatedAt: note.updated_at, extras };
  },

  /** "Report this lesson": tells the administrators by email (no account needed; bot check required). */
  'POST /shared/report': async (ctx, body) => {
    await limit(ctx, 'report-ip', clientIP(ctx), 5, 3600);
    const id = str(body, 'id', 30);
    if (!SHARE_RE.test(id)) throw new HttpError(400, 'Invalid lesson.');
    await turnstile(ctx, body);
    const reason = str(body, 'reason', 1200).replace(/\s+/g, ' ').trim().slice(0, 1000);
    const share = await ctx.env.DB.prepare('SELECT id FROM shares WHERE id = ?').bind(id).first();
    if (!share) return { ok: true };
    const admins = (ctx.env.ADMIN_USERNAMES ?? '')
      .split(',')
      .map((x) => x.trim().toLowerCase())
      .filter(Boolean);
    for (const name of admins.slice(0, 5)) {
      const a = await ctx.env.DB.prepare('SELECT email_enc FROM users WHERE username = ? AND verified = 1').bind(name).first<{ email_enc: string }>();
      if (!a) continue;
      mail(ctx, {
        to: await decryptEmail(ctx.keys, a.email_enc),
        subject: 'A shared lesson was reported on Ancient Pathfinder',
        text: `A reader reported a shared lesson.\n\nLesson: ${ctx.site}/#lesson/${id}\nReason given: ${reason || '(none)'}\n\nTo look at it, open the link while signed in as an administrator; a "Remove" button appears on the lesson, which stops the link working. The person who shared it can share it again only by making a new link.`,
      });
    }
    return { ok: true };
  },

  /** Administrators: take a shared lesson down (the link stops working; the owner keeps their lesson). */
  'POST /shared/remove': async (ctx, body) => {
    const s = await requireUser(ctx);
    if (!isAdmin(ctx, s.user.username)) throw new HttpError(403, 'Only administrators can do this.');
    await ctx.env.DB.prepare('DELETE FROM shares WHERE id = ?').bind(str(body, 'id', 30)).run();
    return { ok: true };
  },
};
