/**
 * Downloads of your own content (lessons, notebook pages, notebooks, verse notes, your journeys and lists),
 * for working outside the app: a printable page ("Print / Save as PDF") or an editable Word file.
 *
 * Everything is put together on the device; nothing is sent anywhere or stored. Both formats are drawn from
 * the same simple document made here (headings, paragraphs, lists, quotes, links and passages).
 *
 * Bible text in downloads (the owner's decision, November 2026, after re-reading the publishers' terms):
 *   - Word files are editable and kept indefinitely, so they carry public-domain text only (KJV, WEB…).
 *   - Printouts (and "Save as PDF", which is the same printing) may carry the reader's licensed translation
 *     within the printing limits the app already keeps: the ESV up to 500 verses in a printout and never half
 *     of a book (Crossway); the NASB 1995, CSB and NKJV up to 100 verses (API.Bible's printing rule). Each
 *     translation's notice goes at the end, "(ESV)" after each ESV passage, and API.Bible's credit with a link.
 *     Passages past a limit appear as references, with a line saying why.
 *   - Licensed text is fetched through the usual channels (the relay, API.Bible's view tracking) and kept in
 *     memory only while the print preview is open.
 * Every passage carries a link that opens it in Ancient Pathfinder (#read/<passage>).
 */
import { BOOKS } from '../data/books';
import {
  BIBLE_API_TRANSLATIONS,
  ESV_TERMS,
  fetchPassage,
  isLicensed,
  translationNotice,
  versesInChapter,
  type Translation,
} from './bible';
import { allJourneys } from './journeys';
import { allLists } from './lists';
import { byPosition, noteSpan, notebooksOf, pagesIn, type Note, type MyStop, type LessonStep } from './notes';
import { bookIndex, findRefs, spanFromOsis, spanLabel, spanToOsis, type Span } from './refs';

export interface Run {
  text: string;
  b?: boolean;
  i?: boolean;
  href?: string;
  /** a line break before this run */
  br?: boolean;
}

export interface PassageVerse {
  chapter: number;
  verse: number;
  text: string;
}

export type Block =
  | { t: 'h'; level: 1 | 2 | 3; runs: Run[] }
  | { t: 'p'; runs: Run[]; muted?: boolean }
  | { t: 'list'; ordered: boolean; items: Run[][] }
  | { t: 'quote'; runs: Run[] }
  | {
      t: 'passage';
      span: Span;
      /** the heading above already names the passage (and links to it) */
      hideRef?: boolean;
      /** filled in by fillPassages */
      verses?: PassageVerse[];
      code?: string;
      omitted?: 'limit' | 'error';
    };

export interface ExportDoc {
  title: string;
  subtitle?: string;
  blocks: Block[];
  /** set by fillPassages: notices for the translations used, and a line about anything left out */
  credits: { text: string; href?: string }[];
}

/** The address of the site, for links back into it. */
export const siteUrl = () => (typeof window === 'undefined' ? 'https://ancientpathfinder.com/' : window.location.origin + window.location.pathname);
export const readUrl = (s: Span) => `${siteUrl()}#read/${spanToOsis(s)}`;

// ------------------------------------------------------------------------------- note formatting

/** **bold**, *italic*, _italic_, and verse references turned into links. */
export function inlineRuns(text: string, base: Omit<Run, 'text'> = {}): Run[] {
  const out: Run[] = [];
  const re = /\*\*(.+?)\*\*|(?<![*\w])\*(?!\s)(.+?)(?<!\s)\*(?![*\w])|(?<![_\w])_(?!\s)(.+?)(?<!\s)_(?![_\w])/g;
  let last = 0;
  let m: RegExpExecArray | null;
  const plain = (s: string) => {
    let at = 0;
    for (const r of findRefs(s)) {
      if (r.start > at) out.push({ ...base, text: s.slice(at, r.start) });
      out.push({ ...base, text: s.slice(r.start, r.end), href: readUrl(r) });
      at = r.end;
    }
    if (at < s.length) out.push({ ...base, text: s.slice(at) });
  };
  while ((m = re.exec(text))) {
    if (m.index > last) plain(text.slice(last, m.index));
    if (m[1] != null) out.push(...inlineRuns(m[1], { ...base, b: true }));
    else out.push(...inlineRuns(m[2] ?? m[3], { ...base, i: true }));
    last = m.index + m[0].length;
  }
  if (last < text.length) plain(text.slice(last));
  return out;
}

const joinLines = (lines: string[]): Run[] =>
  lines.flatMap((l, i) => {
    const runs = inlineRuns(l);
    if (i > 0) runs[0] = { ...(runs[0] ?? { text: '' }), br: true };
    return runs;
  });

/** A note's writing (the same small Markdown subset as NoteText) as blocks; "#" headings become `top`. */
export function noteBlocks(text: string, top: 2 | 3 = 2): Block[] {
  const blocks: Block[] = [];
  let para: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  let quote: string[] = [];
  const flush = () => {
    if (para.length) blocks.push({ t: 'p', runs: joinLines(para) });
    if (list) blocks.push({ t: 'list', ordered: list.ordered, items: list.items.map((l) => inlineRuns(l)) });
    if (quote.length) blocks.push({ t: 'quote', runs: joinLines(quote) });
    para = [];
    list = null;
    quote = [];
  };
  for (const raw of text.split('\n')) {
    const line = raw.replace(/\s+$/, '');
    let m: RegExpExecArray | null;
    if (!line.trim()) flush();
    else if ((m = /^(#{1,3})\s+(.*)$/.exec(line))) {
      flush();
      blocks.push({ t: 'h', level: m[1].length === 1 ? top : 3, runs: inlineRuns(m[2]) });
    } else if ((m = /^\s*[-*•]\s+(.*)$/.exec(line))) {
      if (para.length || quote.length || (list && list.ordered)) flush();
      list ??= { ordered: false, items: [] };
      list.items.push(m[1]);
    } else if ((m = /^\s*\d{1,3}[.)]\s+(.*)$/.exec(line))) {
      if (para.length || quote.length || (list && !list.ordered)) flush();
      list ??= { ordered: true, items: [] };
      list.items.push(m[1]);
    } else if ((m = /^>\s?(.*)$/.exec(line))) {
      if (para.length || list) flush();
      quote.push(m[1]);
    } else {
      if (list || quote.length) flush();
      para.push(line);
    }
  }
  flush();
  return blocks;
}

// ------------------------------------------------------------------------------------ builders

const h = (level: 1 | 2 | 3, text: string): Block => ({ t: 'h', level, runs: [{ text }] });
const muted = (text: string): Block => ({ t: 'p', runs: [{ text }], muted: true });
const dateLabel = (d?: string) =>
  d ? new Date(d + 'T12:00').toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) : '';
const passageOf = (osis?: string): Block | null => {
  const s = osis ? spanFromOsis(osis) : null;
  return s ? { t: 'passage', span: s } : null;
};

/** The STEP_KINDS labels, kept here so this file doesn't need the editor. */
const STEP_LABEL: Record<LessonStep['type'], string> = {
  passage: 'Passage',
  note: 'Notes',
  place: 'Map stop',
  journey: 'Journey',
  list: 'List',
  page: 'Page',
  link: 'Web link',
};

function findCollection(kind: 'journey' | 'list', id?: string) {
  const all = kind === 'journey' ? allJourneys() : allLists();
  return all.find((x) => x.id === id || x.id === `my:${id}` || x.id === `shared:${id}`);
}

function stepLine(s: LessonStep): string {
  switch (s.type) {
    case 'passage': {
      const sp = s.ref ? spanFromOsis(s.ref) : null;
      return sp ? spanLabel(sp) : 'Passage';
    }
    case 'note':
      return s.note.split('\n').find((l) => l.trim())?.replace(/^[#>*\-\s]+/, '').slice(0, 60) || 'Notes';
    case 'place':
      return s.place || 'Map stop';
    case 'journey':
    case 'list': {
      const c = findCollection(s.type, s.id);
      return `${c?.title ?? STEP_LABEL[s.type]}, ${s.type === 'journey' ? 'stop' : 'item'} ${(s.index ?? 0) + 1}`;
    }
    case 'page':
      return s.label || 'Page';
    case 'link':
      try {
        return s.label || new URL(s.url ?? '').hostname;
      } catch {
        return 'Web link';
      }
  }
}

/** A class lesson. `notes: false` leaves out your teaching notes (a handout for the class). */
export function lessonDoc(n: Note, opts: { notes: boolean }): ExportDoc {
  const blocks: Block[] = [];
  if (n.summary?.trim()) blocks.push(...noteBlocks(n.summary));
  (n.steps ?? []).forEach((s, i) => {
    const line = stepLine(s);
    const sp = s.type === 'passage' && s.ref ? spanFromOsis(s.ref) : null;
    // an untitled passage step: the heading is the reference, linked
    blocks.push(sp && !s.title ? { t: 'h', level: 1, runs: [{ text: `${i + 1}. ` }, { text: line, href: readUrl(sp) }] } : h(1, `${i + 1}. ${s.title || line}`));
    const kind = STEP_LABEL[s.type];
    const meta = s.title && s.type !== 'note' ? `${kind}: ${line}` : s.type === 'note' ? '' : kind;
    if (meta && s.type !== 'passage' && s.type !== 'link') blocks.push(muted(meta));
    if (sp) blocks.push({ t: 'passage', span: sp, hideRef: !s.title }); else if (s.ref) {
      const sp = spanFromOsis(s.ref);
      if (sp) blocks.push({ t: 'p', runs: [{ text: 'Verse: ' }, { text: spanLabel(sp), href: readUrl(sp) }], muted: true });
    }
    if (s.type === 'link' && s.url) blocks.push({ t: 'p', runs: [{ text: `${kind}: ` }, { text: s.label || s.url, href: s.url }], muted: true });
    if (opts.notes && s.note.trim()) blocks.push(...noteBlocks(s.note, 3));
  });
  if (!n.steps?.length) blocks.push(muted('This lesson has no steps yet.'));
  return { title: n.title || 'Lesson', subtitle: opts.notes ? undefined : 'Class handout', blocks, credits: [] };
}

/** A page's date, passages and writing; `withTitle` adds its title as a heading (inside a notebook). */
function pageBlocks(n: Note, withTitle: boolean): Block[] {
  const blocks: Block[] = [];
  if (withTitle) blocks.push(h(1, n.title || 'Untitled page'));
  const d = dateLabel(n.date);
  if (d) blocks.push(muted(d));
  for (const p of n.passages ?? []) {
    const b = passageOf(p);
    if (b) blocks.push(b);
  }
  blocks.push(...noteBlocks(n.body, 2));
  return blocks;
}

/** One notebook page. */
export function pageDoc(n: Note): ExportDoc {
  return { title: n.title || 'Untitled page', blocks: pageBlocks(n, false), credits: [] };
}

const pageSort = (a: Note, b: Note) => (a.date ?? '').localeCompare(b.date ?? '') || a.createdAt - b.createdAt;

/** A notebook (its own pages, then each folder's) or one folder. */
export function notebookDoc(id: string, s: { notebooks: import('./notes').Notebook[]; notes: Note[] }): ExportDoc {
  const nb = s.notebooks.find((b) => b.id === id);
  const blocks: Block[] = [];
  const own = pagesIn(id, false, s as never).sort(pageSort);
  for (const p of own) blocks.push(...pageBlocks(p, true));
  if (nb && !nb.parentId) {
    for (const f of notebooksOf(id, s.notebooks).sort(byPosition)) {
      const pages = pagesIn(f.id, false, s as never).sort(pageSort);
      blocks.push({ t: 'h', level: 1, runs: [{ text: `Folder: ${f.name}` }] });
      if (!pages.length) blocks.push(muted('No pages.'));
      for (const p of pages) blocks.push(...pageBlocks(p, true));
    }
  }
  if (!blocks.length) blocks.push(muted('No pages yet.'));
  return { title: nb?.name ?? 'Notebook', blocks, credits: [] };
}

/** Verse notes in Bible order; `book` (an OSIS code) limits them to one book. */
export function verseNotesDoc(notes: Note[], book?: string): ExportDoc {
  const list = notes
    .filter((n) => n.kind === 'verse' && noteSpan(n) && (!book || noteSpan(n)!.osis === book))
    .sort((a, b) => {
      const x = noteSpan(a)!;
      const y = noteSpan(b)!;
      return bookIndex(x.osis) - bookIndex(y.osis) || x.chapter - y.chapter || (x.verse ?? 0) - (y.verse ?? 0);
    });
  const blocks: Block[] = [];
  let lastBook = '';
  for (const n of list) {
    const sp = noteSpan(n)!;
    if (!book && sp.osis !== lastBook) {
      blocks.push(h(1, BOOKS.find((b) => b.osis === sp.osis)?.name ?? sp.osis));
      lastBook = sp.osis;
    }
    blocks.push({ t: 'h', level: 2, runs: [{ text: spanLabel(sp), href: readUrl(sp) }] });
    blocks.push({ t: 'passage', span: sp, hideRef: true });
    blocks.push(...noteBlocks(n.body, 3));
  }
  if (!list.length) blocks.push(muted('No verse notes yet.'));
  const bookName = book ? BOOKS.find((b) => b.osis === book)?.name : '';
  return { title: bookName ? `Verse notes: ${bookName}` : 'Verse notes', blocks, credits: [] };
}

/** One of your own journeys or lists. */
export function mineDoc(n: Note): ExportDoc {
  const journey = n.kind === 'journey';
  const stops: MyStop[] = (journey ? n.stops : n.items) ?? [];
  const blocks: Block[] = [];
  if (n.summary?.trim()) blocks.push(...noteBlocks(n.summary));
  stops.forEach((s, i) => {
    const sp = s.ref ? spanFromOsis(s.ref) : null;
    const name = journey ? s.place || s.event || (sp ? spanLabel(sp) : `Stop ${i + 1}`) : s.t || (sp ? spanLabel(sp) : `Item ${i + 1}`);
    blocks.push(h(1, `${i + 1}. ${name}`));
    const meta = [journey ? s.event && s.event !== name ? s.event : '' : s.meta, s.day, s.sea ? 'by sea' : ''].filter(Boolean).join(' · ');
    if (meta) blocks.push(muted(meta));
    if (sp) blocks.push({ t: 'passage', span: sp });
    if (s.note?.trim()) blocks.push(...noteBlocks(s.note, 3));
  });
  if (!stops.length) blocks.push(muted(journey ? 'No stops yet.' : 'No items yet.'));
  return { title: n.title || (journey ? 'My journey' : 'My list'), subtitle: journey ? 'Journey' : 'Study list', blocks, credits: [] };
}

/** Everything: verse notes, notebooks, lessons, journeys and lists, one after another. */
export function everythingDoc(s: { notebooks: import('./notes').Notebook[]; notes: Note[] }, opts: { notes: boolean }): ExportDoc {
  const blocks: Block[] = [];
  const section = (title: string, d: ExportDoc) => {
    blocks.push({ t: 'h', level: 1, runs: [{ text: title }] });
    // one level down, so each part sits under its own heading
    for (const b of d.blocks) blocks.push(b.t === 'h' && b.level < 3 ? { ...b, level: (b.level + 1) as 2 | 3 } : b);
  };
  if (s.notes.some((n) => n.kind === 'verse')) section('Verse notes', verseNotesDoc(s.notes));
  for (const b of notebooksOf(null, s.notebooks).sort(byPosition)) section(b.name, notebookDoc(b.id, s));
  const loose = s.notes.filter((n) => n.kind === 'page' && !n.notebookId).sort(pageSort);
  for (const p of loose) section(p.title || 'Untitled page', pageDoc(p));
  for (const n of s.notes.filter((x) => x.kind === 'lesson')) section(`Lesson: ${n.title || 'Lesson'}`, lessonDoc(n, opts));
  for (const n of s.notes.filter((x) => x.kind === 'journey' || x.kind === 'list'))
    section(`${n.kind === 'journey' ? 'Journey' : 'List'}: ${n.title || 'Untitled'}`, mineDoc(n));
  if (!blocks.length) blocks.push(muted('Nothing here yet.'));
  return { title: 'My Content', subtitle: 'Ancient Pathfinder', blocks, credits: [] };
}

export const hasPassages = (d: ExportDoc) => d.blocks.some((b) => b.t === 'passage');

// --------------------------------------------------------------------------------- Bible text

/** The translations a download may carry: public domain always; the reader's licensed one only in print. */
export function translationsFor(format: 'print' | 'word', reading: Translation): Translation[] {
  const pd = BIBLE_API_TRANSLATIONS;
  if (format === 'word' || !isLicensed(reading)) return pd;
  return [reading, ...pd];
}

/** How many verses of a translation a printout may hold, and whether a book's share is limited. */
export function verseLimit(t: Translation): { total: number; halfBook: boolean } {
  if (t.provider === 'esv') return { total: ESV_TERMS.maxVersesPerPage, halfBook: true };
  if (t.provider === 'apibible') return { total: 100, halfBook: false };
  // public domain: no rule, but keep a long notebook from making hundreds of requests
  return { total: 3000, halfBook: false };
}

const bookTotal = (osis: string) => {
  let n = 0;
  for (let c = 1; versesInChapter(osis, c); c++) n += versesInChapter(osis, c);
  return n;
};

/** The chapters and verse ranges a span covers. */
function spanParts(s: Span): { chapter: number; from: number; to: number }[] {
  const out = [];
  for (let c = s.chapter; c <= s.toChapter; c++) {
    const n = versesInChapter(s.osis, c);
    if (!n) continue;
    const from = c === s.chapter ? s.verse ?? 1 : 1;
    const to = c === s.toChapter ? s.toVerse ?? n : n;
    out.push({ chapter: c, from, to: Math.min(to, n) });
  }
  return out;
}

export const spanVerseCount = (s: Span) => spanParts(s).reduce((a, p) => a + p.to - p.from + 1, 0);

/**
 * Puts the verses into a document's passages, in order, within the translation's limits. Returns a new
 * document; `t` null means references only. Word files never get licensed text, whatever is asked.
 */
export async function fillPassages(doc: ExportDoc, t: Translation | null, format: 'print' | 'word', onProgress?: (done: number, total: number) => void): Promise<ExportDoc> {
  if (t && format === 'word' && isLicensed(t)) t = null;
  const blocks: Block[] = doc.blocks.map((b): Block => (b.t === 'passage' ? { t: 'passage', span: b.span, hideRef: b.hideRef } : b));
  const credits: ExportDoc['credits'] = [];
  if (!t) return { ...doc, blocks, credits };
  const limit = verseLimit(t);
  let used = 0;
  const perBook = new Map<string, number>();
  let skipped = 0;
  let failed = 0;
  const passages = blocks.filter((b): b is Extract<Block, { t: 'passage' }> => b.t === 'passage');
  let done = 0;
  for (const b of passages) {
    onProgress?.(done++, passages.length);
    const count = spanVerseCount(b.span);
    const inBook = (perBook.get(b.span.osis) ?? 0) + count;
    const bookMax = limit.halfBook ? Math.floor(bookTotal(b.span.osis) * ESV_TERMS.maxBookFraction) : Infinity;
    if (!count || used + count > limit.total || inBook > bookMax) {
      b.omitted = 'limit';
      skipped++;
      continue;
    }
    try {
      const verses: PassageVerse[] = [];
      for (const p of spanParts(b.span)) {
        const got = await fetchPassage(t, b.span.osis, p.chapter, { from: p.from, to: p.to });
        for (const v of got) if (v.verse >= p.from && v.verse <= p.to) verses.push({ chapter: p.chapter, verse: v.verse, text: v.text });
      }
      if (!verses.length) throw new Error('no verses');
      b.verses = verses;
      b.code = t.code.toUpperCase();
      used += count;
      perBook.set(b.span.osis, inBook);
    } catch {
      b.omitted = 'error';
      failed++;
    }
  }
  onProgress?.(passages.length, passages.length);
  if (used) {
    credits.push({ text: translationNotice(t) });
    if (t.provider === 'apibible') credits.push({ text: 'Text provided by API.Bible', href: 'https://api.bible' });
  }
  if (skipped) {
    const why =
      t.provider === 'esv'
        ? 'Crossway allows up to 500 ESV verses in one printout, and never half of a book'
        : t.provider === 'apibible'
          ? `the publisher allows up to 100 verses of the ${t.code === 'NASB1995' ? 'NASB 1995' : t.code} in one printout`
          : 'very long downloads are kept to 3,000 verses';
    credits.push({ text: `${skipped} passage${skipped === 1 ? ' is' : 's are'} shown as a reference only: ${why}. Choose the KJV or WEB to include every passage.` });
  }
  if (failed) credits.push({ text: `${failed} passage${failed === 1 ? '' : 's'} couldn’t be fetched and ${failed === 1 ? 'is' : 'are'} shown as a reference only.` });
  return { ...doc, blocks, credits };
}

/** A file name from a title: "Passion Week lesson.docx" */
export const fileName = (title: string, ext: string) =>
  `${title.replace(/[\\/:*?"<>|#%&{}$!'@+`=]+/g, '').replace(/\s+/g, ' ').trim().slice(0, 80) || 'Ancient Pathfinder'}.${ext}`;
