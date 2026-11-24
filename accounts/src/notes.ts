/**
 * Notes (on a verse or a range of verses), notebooks (notebook → folder → page), and your own journeys and
 * study lists (kinds "journey" and "list", kept in the same table).
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
export { cleanBody };

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
  // journeys and lists
  color?: string;
  summary?: string;
  from?: string;
  stops?: Record<string, unknown>[];
  items?: Record<string, unknown>[];
  steps?: Record<string, unknown>[];
}

const STEP_TYPES = new Set(['passage', 'note', 'place', 'journey', 'list', 'page', 'link']);
const PAGE_TYPES = new Set(['person', 'nation', 'period', 'jerusalem']);
const SLUG_RE = /^[A-Za-z0-9_.-]{1,60}$/;
const MAX_STEPS = 100;
const STEP_NOTE_MAX = 5000;

/** One step of a class lesson: only known fields, each checked. */
function readStep(raw: unknown): Record<string, unknown> {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new HttpError(400, 'Invalid step.');
  const r = raw as Record<string, unknown>;
  const type = str(r, 'type', 12);
  if (!STEP_TYPES.has(type)) throw new HttpError(400, 'Invalid step.');
  const note = cleanBody(typeof r.note === 'string' ? r.note : '');
  if (note.length > STEP_NOTE_MAX) throw new HttpError(400, `A step's notes can be up to ${STEP_NOTE_MAX.toLocaleString()} characters.`);
  const out: Record<string, unknown> = { type, note };
  const title = cleanText(str(r, 'title', 300), 120);
  if (title) out.title = title;
  const ref = str(r, 'ref', 40);
  if (type === 'passage') {
    if (!PASSAGE_RE.test(ref)) throw new HttpError(400, 'A passage step needs a passage.');
    out.ref = ref;
  } else if (ref && VERSE_RE.test(ref)) out.ref = ref;
  if (type === 'place') {
    const lat = num(r.lat, -90, 90);
    const lon = num(r.lon, -180, 180);
    if (lat == null || lon == null) throw new HttpError(400, 'A map step needs a place.');
    out.lat = Math.round(lat * 1e5) / 1e5;
    out.lon = Math.round(lon * 1e5) / 1e5;
    out.place = cleanText(str(r, 'place', 200), 80) || 'A spot on the map';
    const pi = num(r.placeIndex, 0, 100000);
    if (pi != null) out.placeIndex = Math.floor(pi);
  }
  if (type === 'journey' || type === 'list') {
    const source = str(r, 'source', 8);
    const id = str(r, 'id', 40);
    if ((source !== 'builtin' && source !== 'mine') || !SLUG_RE.test(id)) throw new HttpError(400, 'Choose a journey or list.');
    out.source = source;
    out.id = id;
    out.index = Math.floor(num(r.index, 0, 1000) ?? 0);
  }
  if (type === 'page') {
    const pageType = str(r, 'pageType', 12);
    const id = str(r, 'id', 60);
    if (!PAGE_TYPES.has(pageType) || !SLUG_RE.test(id)) throw new HttpError(400, 'Choose a page.');
    out.pageType = pageType;
    out.id = id;
    out.label = cleanText(str(r, 'label', 200), 80);
  }
  if (type === 'link') {
    const url = str(r, 'url', 600).trim();
    let ok = false;
    try {
      const u = new URL(url);
      ok = (u.protocol === 'https:' || u.protocol === 'http:') && !!u.hostname && url.length <= 500;
    } catch {
      ok = false;
    }
    if (!ok) throw new HttpError(400, 'A link step needs a web address starting with https://');
    out.url = url;
    out.label = cleanText(str(r, 'label', 300), 120);
  }
  if (type === 'note' && !note.trim() && !title) throw new HttpError(400, 'A notes step needs some writing.');
  return out;
}

const KINDS = new Set(['verse', 'page', 'journey', 'list', 'lesson']);
const COLOR_RE = /^#[0-9a-fA-F]{6}$/;
const ID_RE = /^[a-z0-9-]{1,40}$/;
const MAX_STOPS = 150;
const STOP_NOTE_MAX = 1500;

const num = (v: unknown, min: number, max: number) => (typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max ? v : null);

/** One stop of your own journey, or one item of your own list: only known fields, each checked. */
function readStop(raw: unknown, kind: 'journey' | 'list'): Record<string, unknown> {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new HttpError(400, 'Invalid stop.');
  const r = raw as Record<string, unknown>;
  const ref = str(r, 'ref', 20);
  if (!VERSE_RE.test(ref)) throw new HttpError(400, 'Each stop needs a verse.');
  const note = cleanBody(typeof r.note === 'string' ? r.note : '');
  if (note.length > STOP_NOTE_MAX) throw new HttpError(400, `A stop's note can be up to ${STOP_NOTE_MAX.toLocaleString()} characters.`);
  const lat = num(r.lat, -90, 90);
  const lon = num(r.lon, -180, 180);
  const out: Record<string, unknown> = { ref, note };
  const place = cleanText(str(r, 'place', 200), 80);
  if (place) out.place = place;
  if (lat != null && lon != null) {
    out.lat = Math.round(lat * 1e5) / 1e5;
    out.lon = Math.round(lon * 1e5) / 1e5;
  }
  const pi = num(r.placeIndex, 0, 100000);
  if (pi != null) out.placeIndex = Math.floor(pi);
  if (kind === 'journey') {
    if (out.lat == null) throw new HttpError(400, 'Each stop needs a place on the map.');
    if (r.sea === true) out.sea = true;
    const day = cleanText(str(r, 'day', 100), 40);
    const event = cleanText(str(r, 'event', 200), 80);
    if (day) out.day = day;
    if (event) out.event = event;
    if (Array.isArray(r.via)) {
      const via = r.via
        .slice(0, 300)
        .filter((p): p is [number, number] => Array.isArray(p) && num(p[0], -90, 90) != null && num(p[1], -180, 180) != null)
        .map((p) => [Math.round(p[0] * 1e5) / 1e5, Math.round(p[1] * 1e5) / 1e5]);
      if (via.length) out.via = via;
    }
  } else {
    const t = cleanText(str(r, 't', 300), 120);
    if (!t) throw new HttpError(400, 'Each item needs a name.');
    out.t = t;
    const meta = cleanText(str(r, 'meta', 200), 60);
    if (meta) out.meta = meta;
    if (Array.isArray(r.words)) {
      const words = r.words
        .filter((w): w is string => typeof w === 'string')
        .slice(0, 6)
        .map((w) => cleanText(w, 40))
        .filter(Boolean);
      if (words.length) out.words = words;
    }
  }
  return out;
}

/** Writing keeps its line breaks; only invisible control characters are removed. */
function cleanBody(s: string) {
  // eslint-disable-next-line no-control-regex
  return s.replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f‪-‮⁦-⁩]/g, '');
}

function readNote(kind: string, raw: unknown): NoteData {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new HttpError(400, 'Invalid note.');
  const n = raw as Record<string, unknown>;
  if (kind === 'lesson') {
    const title = cleanText(str(n, 'title', 400), 120) || 'My lesson';
    const summary = cleanBody(typeof n.summary === 'string' ? n.summary : '').slice(0, 2000);
    const list = Array.isArray(n.steps) ? n.steps : [];
    if (list.length > MAX_STEPS) throw new HttpError(400, `Up to ${MAX_STEPS} steps.`);
    return { title, summary, steps: list.map(readStep), body: '' };
  }
  if (kind === 'journey' || kind === 'list') {
    const title = cleanText(str(n, 'title', 400), 120) || (kind === 'journey' ? 'My journey' : 'My list');
    const color = str(n, 'color', 7);
    const summary = cleanBody(typeof n.summary === 'string' ? n.summary : '').slice(0, 1000);
    const from = str(n, 'from', 40);
    const rawStops = kind === 'journey' ? n.stops : n.items;
    const list = Array.isArray(rawStops) ? rawStops : [];
    if (list.length > MAX_STOPS) throw new HttpError(400, `Up to ${MAX_STOPS} stops.`);
    const stops = list.map((x) => readStop(x, kind));
    return {
      title,
      color: COLOR_RE.test(color) ? color : '#1971c2',
      summary,
      ...(from && ID_RE.test(from) ? { from } : {}),
      ...(kind === 'journey' ? { stops } : { items: stops }),
      body: '',
    };
  }
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
    if (!KINDS.has(kind)) throw new HttpError(400, 'Invalid note.');
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
    const id = str(body, 'id', 40);
    await ctx.env.DB.batch([
      // a deleted lesson's share link stops working too
      ctx.env.DB.prepare('DELETE FROM shares WHERE note_id = ? AND user_id = ?').bind(id, s.user.id),
      ctx.env.DB.prepare('DELETE FROM notes WHERE id = ? AND user_id = ?').bind(id, s.user.id),
    ]);
    return { ok: true };
  },
};
