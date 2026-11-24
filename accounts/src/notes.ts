/**
 * Notes (on a verse or a range of verses) and notebooks (notebook → folder → page).
 *
 * Everything the person writes, including notebook and folder names, page titles and dates, is stored
 * encrypted (AES-GCM, the "notes-enc" key). Only the structure is readable: which notebook or folder an item
 * is in, its size, and when it changed. The app checks for licensed Bible wording before saving (the
 * service can't: licensed text is never stored here to compare with), and the terms ask people to write in
 * their own words.
 *
 * Unlocking costs a little computing time per item, so lists come back in batches of 100.
 */
import { decryptText, encryptText, randomToken } from './crypto';
import { cleanText, HttpError, limit, now, requireUser, str, type Ctx, type Route } from './worker';

const VERSE_NOTE_MAX = 5000;
const PAGE_MAX = 20000;
const MAX_NOTES = 3000;
const MAX_TOTAL_BYTES = 6_000_000;
const MAX_NOTEBOOKS = 300;
const BATCH = 100;

const VERSE_RE = /^[1-3]?[A-Z][A-Za-z]{1,5}\.\d{1,3}\.\d{1,3}$/;
const PASSAGE_RE = /^[1-3]?[A-Z][A-Za-z]{1,5}\.\d{1,3}(\.\d{1,3})?(-[1-3]?[A-Z][A-Za-z]{1,5}\.\d{1,3}(\.\d{1,3})?)?$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

interface NoteData {
  ref?: string;
  end?: string;
  title?: string;
  date?: string;
  passages?: string[];
  body: string;
}

/** Writing keeps its line breaks; only invisible control characters are removed. */
function cleanBody(s: string) {
  // eslint-disable-next-line no-control-regex
  return s.replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f‪-‮⁦-⁩]/g, '');
}

function readNote(kind: string, raw: unknown): NoteData {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new HttpError(400, 'Invalid note.');
  const n = raw as Record<string, unknown>;
  const body = cleanBody(typeof n.body === 'string' ? n.body : '');
  if (kind === 'verse') {
    const ref = str(n, 'ref', 20);
    const end = str(n, 'end', 20);
    if (!VERSE_RE.test(ref)) throw new HttpError(400, 'Invalid verse.');
    if (end && !VERSE_RE.test(end)) throw new HttpError(400, 'Invalid verse range.');
    if (body.length > VERSE_NOTE_MAX) throw new HttpError(400, `A verse note can be up to ${VERSE_NOTE_MAX.toLocaleString()} characters.`);
    return { ref, end: end || undefined, body };
  }
  const title = cleanText(str(n, 'title', 400), 200);
  const date = str(n, 'date', 10);
  if (date && !DATE_RE.test(date)) throw new HttpError(400, 'Invalid date.');
  const passages = Array.isArray(n.passages) ? n.passages.filter((p): p is string => typeof p === 'string') : [];
  if (passages.length > 30 || passages.some((p) => !PASSAGE_RE.test(p))) throw new HttpError(400, 'Invalid passages.');
  if (body.length > PAGE_MAX) throw new HttpError(400, `A page can be up to ${PAGE_MAX.toLocaleString()} characters.`);
  return { title, date: date || undefined, passages, body };
}

async function ownNotebook(ctx: Ctx, userId: string, id: string) {
  return ctx.env.DB.prepare('SELECT id, parent_id FROM notebooks WHERE id = ? AND user_id = ?')
    .bind(id, userId)
    .first<{ id: string; parent_id: string | null }>();
}

export const NOTE_ROUTES: Record<string, Route> = {
  // ---------------------------------------------------------------- notebooks and folders

  'GET /notebooks': async (ctx) => {
    const s = await requireUser(ctx);
    const r = await ctx.env.DB.prepare(
      'SELECT id, parent_id, data, position, created_at FROM notebooks WHERE user_id = ? ORDER BY position, created_at',
    )
      .bind(s.user.id)
      .all<{ id: string; parent_id: string | null; data: string; position: number; created_at: number }>();
    const notebooks = await Promise.all(
      r.results.map(async (b) => ({
        id: b.id,
        parentId: b.parent_id,
        name: await decryptText(ctx.keys.notesEnc, b.data),
        position: b.position,
        createdAt: b.created_at,
      })),
    );
    return { notebooks };
  },

  /** Create or rename a notebook, or a folder (parentId = its notebook; folders don't nest further). */
  'POST /notebooks/save': async (ctx, body) => {
    const s = await requireUser(ctx);
    await limit(ctx, 'notebooks', s.user.id, 300, 3600);
    const name = cleanText(str(body, 'name', 200), 80);
    if (!name) throw new HttpError(400, 'Please give it a name.');
    const id = str(body, 'id', 40);
    const data = await encryptText(ctx.keys.notesEnc, name);
    const db = ctx.env.DB;
    if (id) {
      const r = await db.prepare('UPDATE notebooks SET data = ? WHERE id = ? AND user_id = ?').bind(data, id, s.user.id).run();
      if (!r.meta.changes) throw new HttpError(404, 'That notebook no longer exists.');
      return { id };
    }
    const parentId = str(body, 'parentId', 40) || null;
    if (parentId) {
      const parent = await ownNotebook(ctx, s.user.id, parentId);
      if (!parent || parent.parent_id) throw new HttpError(400, 'Folders go inside a notebook.');
    }
    const count = await db.prepare('SELECT COUNT(*) AS n FROM notebooks WHERE user_id = ?').bind(s.user.id).first<{ n: number }>();
    if ((count?.n ?? 0) >= MAX_NOTEBOOKS) throw new HttpError(400, `You can have up to ${MAX_NOTEBOOKS} notebooks and folders.`);
    const newId = randomToken(12);
    const pos = await db
      .prepare('SELECT COALESCE(MAX(position), -1) + 1 AS p FROM notebooks WHERE user_id = ? AND parent_id IS ?')
      .bind(s.user.id, parentId)
      .first<{ p: number }>();
    await db
      .prepare('INSERT INTO notebooks (id, user_id, parent_id, data, position, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(newId, s.user.id, parentId, data, pos?.p ?? 0, now())
      .run();
    return { id: newId };
  },

  /** Put notebooks (or a notebook's folders) in the order given. */
  'POST /notebooks/order': async (ctx, body) => {
    const s = await requireUser(ctx);
    const ids = Array.isArray(body.ids) ? body.ids.filter((x): x is string => typeof x === 'string').slice(0, MAX_NOTEBOOKS) : [];
    const db = ctx.env.DB;
    if (ids.length)
      await db.batch(ids.map((id, i) => db.prepare('UPDATE notebooks SET position = ? WHERE id = ? AND user_id = ?').bind(i, id, s.user.id)));
    return { ok: true };
  },

  /**
   * Delete a notebook or folder. If it still holds pages, `withPages: true` is needed (the pages are deleted
   * too); deleting a notebook also deletes its folders.
   */
  'POST /notebooks/delete': async (ctx, body) => {
    const s = await requireUser(ctx);
    const id = str(body, 'id', 40);
    const nb = await ownNotebook(ctx, s.user.id, id);
    if (!nb) return { ok: true };
    const db = ctx.env.DB;
    const folders = nb.parent_id
      ? []
      : (await db.prepare('SELECT id FROM notebooks WHERE parent_id = ? AND user_id = ?').bind(id, s.user.id).all<{ id: string }>())
          .results.map((f) => f.id);
    const all = [id, ...folders];
    const marks = all.map(() => '?').join(',');
    const count = await db
      .prepare(`SELECT COUNT(*) AS n FROM notes WHERE user_id = ? AND notebook_id IN (${marks})`)
      .bind(s.user.id, ...all)
      .first<{ n: number }>();
    if ((count?.n ?? 0) > 0 && body.withPages !== true)
      throw new HttpError(409, `It still holds ${count!.n} page${count!.n === 1 ? '' : 's'}.`, 'not-empty');
    await db.batch([
      db.prepare(`DELETE FROM notes WHERE user_id = ? AND notebook_id IN (${marks})`).bind(s.user.id, ...all),
      db.prepare(`DELETE FROM notebooks WHERE user_id = ? AND id IN (${marks})`).bind(s.user.id, ...all),
    ]);
    return { ok: true };
  },

  // ---------------------------------------------------------------------------- notes and pages

  /** All notes and pages, unlocked, 100 at a time: GET /notes?after=<last id>. */
  'GET /notes': async (ctx) => {
    const s = await requireUser(ctx);
    const after = new URL(ctx.req.url).searchParams.get('after') ?? '';
    const r = await ctx.env.DB.prepare(
      'SELECT id, kind, notebook_id, data, version, created_at, updated_at FROM notes WHERE user_id = ? AND id > ? ORDER BY id LIMIT ?',
    )
      .bind(s.user.id, after, BATCH)
      .all<{ id: string; kind: string; notebook_id: string | null; data: string; version: number; created_at: number; updated_at: number }>();
    const notes = await Promise.all(
      r.results.map(async (n) => ({
        id: n.id,
        kind: n.kind,
        notebookId: n.notebook_id,
        version: n.version,
        createdAt: n.created_at,
        updatedAt: n.updated_at,
        ...(JSON.parse(await decryptText(ctx.keys.notesEnc, n.data)) as NoteData),
      })),
    );
    return { notes, next: r.results.length === BATCH ? r.results[r.results.length - 1].id : null };
  },

  /**
   * Create or update a note or page. Updates send the version they started from; if another device saved
   * in between, the answer is 409 with the newer copy, so nothing is silently overwritten.
   */
  'POST /notes/save': async (ctx, body) => {
    const s = await requireUser(ctx);
    await limit(ctx, 'notes-save', s.user.id, 1200, 3600);
    const kind = str(body, 'kind', 10);
    if (kind !== 'verse' && kind !== 'page') throw new HttpError(400, 'Invalid note.');
    const note = readNote(kind, body.note);
    const notebookId = str(body, 'notebookId', 40) || null;
    if (notebookId && !(await ownNotebook(ctx, s.user.id, notebookId)))
      throw new HttpError(400, 'That notebook no longer exists.', 'notebook');
    const data = await encryptText(ctx.keys.notesEnc, JSON.stringify(note));
    const db = ctx.env.DB;
    const t = now();
    const totals = await db
      .prepare('SELECT COUNT(*) AS n, COALESCE(SUM(size), 0) AS bytes FROM notes WHERE user_id = ?')
      .bind(s.user.id)
      .first<{ n: number; bytes: number }>();
    const id = str(body, 'id', 40);
    if (id) {
      const cur = await db
        .prepare('SELECT kind, data, version, size, notebook_id, updated_at FROM notes WHERE id = ? AND user_id = ?')
        .bind(id, s.user.id)
        .first<{ kind: string; data: string; version: number; size: number; notebook_id: string | null; updated_at: number }>();
      if (!cur) throw new HttpError(404, 'This note was deleted on another device.', 'gone');
      if ((totals?.bytes ?? 0) - cur.size + data.length > MAX_TOTAL_BYTES) throw new HttpError(400, 'Your notes are full.');
      const r = await db
        .prepare(
          'UPDATE notes SET data = ?, size = ?, notebook_id = ?, version = version + 1, updated_at = ? WHERE id = ? AND user_id = ? AND version = ?',
        )
        .bind(data, data.length, notebookId, t, id, s.user.id, Number(body.version) || 0)
        .run();
      if (!r.meta.changes) {
        const latest = JSON.parse(await decryptText(ctx.keys.notesEnc, cur.data)) as NoteData;
        throw Object.assign(new HttpError(409, 'This note was changed on another device.', 'conflict'), {
          extra: {
            latest: { id, kind: cur.kind, notebookId: cur.notebook_id, version: cur.version, updatedAt: cur.updated_at, ...latest },
          },
        });
      }
      return { id, version: cur.version + 1, updatedAt: t };
    }
    if ((totals?.n ?? 0) >= MAX_NOTES) throw new HttpError(400, `You can keep up to ${MAX_NOTES.toLocaleString()} notes and pages.`);
    if ((totals?.bytes ?? 0) + data.length > MAX_TOTAL_BYTES) throw new HttpError(400, 'Your notes are full.');
    const newId = randomToken(12);
    await db
      .prepare(
        'INSERT INTO notes (id, user_id, kind, notebook_id, data, size, version, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)',
      )
      .bind(newId, s.user.id, kind, notebookId, data, data.length, t, t)
      .run();
    return { id: newId, version: 1, updatedAt: t, createdAt: t };
  },

  'POST /notes/delete': async (ctx, body) => {
    const s = await requireUser(ctx);
    await ctx.env.DB.prepare('DELETE FROM notes WHERE id = ? AND user_id = ?').bind(str(body, 'id', 40), s.user.id).run();
    return { ok: true };
  },
};
