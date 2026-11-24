/**
 * Keeps licensed Bible wording (ESV, NASB 1995, CSB, NKJV) out of saved notes, as the publishers' terms
 * require (their text may not be stored on our server). The owner chose to BLOCK it, not just warn.
 *
 * How: any run of 8 or more words in a note that matches licensed text currently in memory (the chapters
 * someone has been reading, at most 500 verses per source) is found here. Before blocking, the same verses
 * are checked in the KJV and WEB (public domain): wording that also matches those is allowed, because the
 * NKJV in particular shares many phrases with the KJV. The app can't check text that isn't in memory, so
 * this catches the usual case (copying from what you're reading), and the terms cover the rest.
 */
import { fetchPassage, findTranslation, licensedTextInMemory, type Verse } from './bible';
import { spanLabel, type Span } from './refs';

const N = 8;

interface Word {
  w: string;
  start: number;
  end: number;
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’‘]/g, "'");

function words(text: string): Word[] {
  const out: Word[] = [];
  const re = /[A-Za-z0-9À-ɏ’'‘]+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const w = norm(m[0]).replace(/'/g, '');
    if (w) out.push({ w, start: m.index, end: m.index + m[0].length });
  }
  return out;
}

const plainWords = (text: string) => words(text).map((x) => x.w);

export interface LicensedCopy {
  start: number;
  end: number;
  /** "ESV", "NASB 1995"… */
  translation: string;
  span: Span;
  label: string;
}

const LABEL: Record<string, string> = { ESV: 'ESV', NASB1995: 'NASB 1995', CSB: 'CSB', NKJV: 'NKJV' };

interface Hit {
  code: string;
  osis: string;
  chapter: number;
  verse: number;
}

/** Runs of licensed wording in a note (before the public-domain check). */
function rawCopies(text: string): { start: number; end: number; hits: Hit[] }[] {
  const chunks = licensedTextInMemory();
  if (!chunks.length) return [];
  const ws = words(text);
  if (ws.length < N) return [];
  // every 8-word run in the licensed text → where it came from
  const map = new Map<string, Hit>();
  // newest first, so the chapter being read wins when the same wording is in memory twice
  for (const c of [...chunks].reverse()) {
    const seq: { w: string; verse: number }[] = [];
    for (const v of c.verses) for (const w of plainWords(v.text)) seq.push({ w, verse: v.verse });
    for (let i = 0; i + N <= seq.length; i++) {
      const k = seq
        .slice(i, i + N)
        .map((x) => x.w)
        .join(' ');
      if (!map.has(k)) map.set(k, { code: c.code, osis: c.osis, chapter: c.chapter, verse: seq[i].verse });
    }
  }
  const marked: (Hit | null)[] = new Array(ws.length).fill(null);
  for (let i = 0; i + N <= ws.length; i++) {
    const hit = map.get(
      ws
        .slice(i, i + N)
        .map((x) => x.w)
        .join(' '),
    );
    if (hit) for (let j = i; j < i + N; j++) marked[j] ??= hit;
  }
  const runs: { start: number; end: number; hits: Hit[] }[] = [];
  for (let i = 0; i < ws.length; i++) {
    if (!marked[i]) continue;
    let j = i;
    const hits: Hit[] = [];
    while (j < ws.length && marked[j]) hits.push(marked[j++]!);
    runs.push({ start: ws[i].start, end: ws[j - 1].end, hits });
    i = j;
  }
  return runs;
}

/** The same verses in a public-domain translation, as words (null when it can't be fetched). */
async function publicDomainWords(code: 'kjv' | 'web', h: Hit): Promise<Set<string> | null> {
  try {
    const t = findTranslation(`bibleapi:${code}`);
    const verses: Verse[] = await fetchPassage(t, h.osis, h.chapter, { from: 1, to: 999 });
    const seq = verses.flatMap((v) => plainWords(v.text));
    const set = new Set<string>();
    for (let i = 0; i + N <= seq.length; i++) set.add(seq.slice(i, i + N).join(' '));
    return set;
  } catch {
    return null;
  }
}

/**
 * Licensed wording in a note that must not be saved. Wording that also appears in the KJV or WEB is fine.
 */
export async function findLicensedCopies(text: string): Promise<LicensedCopy[]> {
  const runs = rawCopies(text);
  if (!runs.length) return [];
  const out: LicensedCopy[] = [];
  const pdCache = new Map<string, Set<string> | null>();
  for (const run of runs) {
    const first = run.hits[0];
    const last = run.hits[run.hits.length - 1];
    // allowed if every 8-word piece of this run is also public-domain wording
    const pd: Set<string>[] = [];
    for (const code of ['kjv', 'web'] as const) {
      const k = `${code}:${first.osis}.${first.chapter}`;
      if (!pdCache.has(k)) pdCache.set(k, await publicDomainWords(code, first));
      const s = pdCache.get(k);
      if (s) pd.push(s);
    }
    const rw = plainWords(text.slice(run.start, run.end));
    let alsoPublic = pd.length > 0;
    for (let i = 0; alsoPublic && i + N <= rw.length; i++) {
      const k = rw.slice(i, i + N).join(' ');
      if (!pd.some((s) => s.has(k))) alsoPublic = false;
    }
    if (alsoPublic) continue;
    const span: Span = {
      osis: first.osis,
      chapter: first.chapter,
      verse: Math.min(first.verse, last.verse),
      toChapter: first.chapter,
      toVerse: Math.max(first.verse, last.verse),
    };
    out.push({ start: run.start, end: run.end, translation: LABEL[first.code] ?? first.code, span, label: spanLabel(span) });
  }
  return out;
}

/** Public-domain wording of a span, for "use the KJV/WEB wording instead". */
export async function publicDomainText(code: 'kjv' | 'web', span: Span): Promise<string> {
  const t = findTranslation(`bibleapi:${code}`);
  const parts: string[] = [];
  for (let c = span.chapter; c <= span.toChapter; c++) {
    const verses = await fetchPassage(t, span.osis, c, { from: 1, to: 999 });
    for (const v of verses) {
      const from = c === span.chapter ? (span.verse ?? 1) : 1;
      const to = c === span.toChapter ? (span.toVerse ?? 999) : 999;
      if (v.verse >= from && v.verse <= to) parts.push(v.text);
    }
  }
  return parts.join(' ');
}
