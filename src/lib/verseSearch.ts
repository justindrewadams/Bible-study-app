/**
 * Searching Bible wording, in any translation.
 *
 * 1. Find likely verses using text the app may keep on the device: the World English Bible (public domain),
 *    matched loosely (word forms, small typos, missing or reordered words), and the Hebrew and Greek words of
 *    every verse (from STEPBible), so a verse is found by meaning even when its English differs.
 * 2. Fetch just the best few in the reader's own translation (lib/bible.ts fetchVerses), score them again
 *    against that wording, and keep the top 3, each labelled with how it matched.
 * Data: public/data/search/*.json, built by scripts/build-verse-search.mjs; loaded on the first verse search.
 */
import { BOOKS } from '../data/books';
import { contentStems, fold, stem, STOP_WORDS, words } from './stem';

export type MatchKind = 'phrase' | 'all' | 'most' | 'meaning';

export interface VerseCandidate {
  id: number;
  book: string;
  chapter: number;
  verse: number;
  /** the WEB text, for scoring and as a fallback snippet */
  web: string;
  /** share of the search's meaning matched through the Hebrew/Greek words (0–1) */
  meaning: number;
  score: number;
}

export interface VerseHit {
  book: string;
  chapter: number;
  verse: number;
  text: string;
  kind: MatchKind;
  score: number;
}

interface Index {
  book: Uint8Array;
  chapter: Uint16Array;
  verse: Uint16Array;
  web: string[];
  /** folded text with single spaces, for phrase checks */
  flat: string[];
  eng: Map<string, number[]>;
  orig: Map<number, number[]>;
  vocab: Record<string, number[]>;
  size: number;
}

const base = import.meta.env?.BASE_URL ?? '/';
let indexPromise: Promise<Index> | null = null;

/** Folded words joined by single spaces: "For all have sinned, and…" → "for all have sinned and". */
export const flatten = (s: string) => words(s).join(' ');

export function loadVerseIndex(): Promise<Index> {
  indexPromise ??= Promise.all([
    fetch(`${base}data/search/web.json`).then((r) => {
      if (!r.ok) throw new Error(`web.json ${r.status}`);
      return r.json() as Promise<{ books: Record<string, string[][]> }>;
    }),
    fetch(`${base}data/search/orig.json`).then((r) => {
      if (!r.ok) throw new Error(`orig.json ${r.status}`);
      return r.json() as Promise<{ vocab: Record<string, number[]>; verses: Record<string, number[][][]> }>;
    }),
  ])
    .then(([w, o]) => {
      let size = 0;
      for (const b of BOOKS) for (const ch of w.books[b.osis] ?? []) size += ch.length;
      const idx: Index = {
        book: new Uint8Array(size),
        chapter: new Uint16Array(size),
        verse: new Uint16Array(size),
        web: new Array(size),
        flat: new Array(size),
        eng: new Map(),
        orig: new Map(),
        vocab: o.vocab,
        size,
      };
      let id = 0;
      BOOKS.forEach((b, bi) => {
        (w.books[b.osis] ?? []).forEach((ch, ci) =>
          ch.forEach((text, vi) => {
            idx.book[id] = bi;
            idx.chapter[id] = ci + 1;
            idx.verse[id] = vi + 1;
            idx.web[id] = text;
            idx.flat[id] = flatten(text);
            for (const s of new Set(contentStems(text))) {
              let p = idx.eng.get(s);
              if (!p) idx.eng.set(s, (p = []));
              p.push(id);
            }
            for (const c of o.verses[b.osis]?.[ci]?.[vi] ?? []) {
              let p = idx.orig.get(c);
              if (!p) idx.orig.set(c, (p = []));
              p.push(id);
            }
            id++;
          }),
        );
      });
      return idx;
    })
    .catch((e) => {
      indexPromise = null; // try again next time
      throw e;
    });
  return indexPromise;
}

/** Edit distance, giving up past `max`. */
function within(a: string, b: string, max: number): boolean {
  if (Math.abs(a.length - b.length) > max) return false;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      best = Math.min(best, cur[j]);
    }
    if (best > max) return false;
    prev = cur;
  }
  return prev[b.length] <= max;
}

/** Spellings close enough to count: the word itself (1), small typos and longer forms (0.85). */
function variants(idx: Index, t: string): [string, number][] {
  const out: [string, number][] = idx.eng.has(t) ? [[t, 1]] : [];
  const max = t.length >= 8 ? 2 : t.length >= 5 ? 1 : 0;
  if (t.length < 4) return out;
  for (const k of idx.eng.keys()) {
    if (k === t) continue;
    if ((max && within(t, k, max)) || (t.length >= 5 && k.startsWith(t) && k.length - t.length <= 4)) out.push([k, 0.85]);
  }
  return out;
}

/** Should the search also look for verses? Phrases of two or more words that aren't a reference. */
export function wantsVerses(query: string): boolean {
  const ws = words(query);
  return ws.length >= 2 && ws.some((w) => !STOP_WORDS.has(w)) && !/\d/.test(query);
}

interface Term {
  stem: string;
  idf: number;
  eng: Map<number, number>;
  meaning: Set<number>;
}

function terms(idx: Index, query: string): Term[] {
  const stems = [...new Set(contentStems(query))];
  return stems.map((t) => {
    const eng = new Map<number, number>();
    const codes = new Set<number>(idx.vocab[t] ?? []);
    let df = 0;
    for (const [k, w] of variants(idx, t)) {
      const p = idx.eng.get(k)!;
      df = Math.max(df, p.length);
      for (const id of p) if ((eng.get(id) ?? 0) < w) eng.set(id, w);
      if (w === 1) continue;
      for (const c of idx.vocab[k] ?? []) codes.add(c);
    }
    const meaning = new Set<number>();
    for (const c of codes) for (const id of idx.orig.get(c) ?? []) meaning.add(id);
    df = Math.max(df, Math.min(meaning.size, idx.size));
    return { stem: t, idf: Math.log(1 + idx.size / Math.max(1, df)), eng, meaning };
  });
}

/** How well a verse's wording matches: share of the search's weight (0–1), plus a bonus for words in order. */
function wordingScore(ts: Term[], text: string, total: number): { cover: number; order: number; all: boolean } {
  const seq = contentStems(text);
  const have = new Set(seq);
  let cover = 0;
  let all = true;
  const at: number[] = [];
  for (const t of ts) {
    let w = 0;
    let pos = -1;
    if (have.has(t.stem)) {
      w = 1;
      pos = seq.indexOf(t.stem);
    } else {
      const max = t.stem.length >= 8 ? 2 : t.stem.length >= 5 ? 1 : 0;
      const i = seq.findIndex((s) => (max && within(t.stem, s, max)) || (t.stem.length >= 5 && s.startsWith(t.stem)));
      if (i >= 0) {
        w = 0.85;
        pos = i;
      }
    }
    if (!w) all = false;
    cover += w * t.idf;
    at.push(pos);
  }
  let order = 0;
  for (let i = 1; i < at.length; i++) if (at[i] >= 0 && at[i - 1] >= 0 && at[i] - at[i - 1] >= 1 && at[i] - at[i - 1] <= 3) order++;
  return { cover: total ? cover / total : 0, order, all };
}

/** Step 1: the most likely verses, judged on the WEB text and the Hebrew/Greek words. */
export function findCandidates(idx: Index, query: string, limit = 8): VerseCandidate[] {
  const ts = terms(idx, query);
  if (!ts.length) return [];
  const total = ts.reduce((n, t) => n + t.idf, 0);
  const phrase = flatten(query);
  const ids = new Set<number>();
  for (const t of ts) {
    for (const id of t.eng.keys()) ids.add(id);
    for (const id of t.meaning) ids.add(id);
  }
  const scored: VerseCandidate[] = [];
  for (const id of ids) {
    let eng = 0;
    let meaning = 0;
    for (const t of ts) {
      const e = t.eng.get(id) ?? 0;
      const m = t.meaning.has(id) ? 1 : 0;
      eng += e * t.idf;
      meaning += m * t.idf;
      // count each word once: by its wording, or failing that by its meaning
    }
    let cover = 0;
    for (const t of ts) cover += Math.max(t.eng.get(id) ?? 0, t.meaning.has(id) ? 0.75 : 0) * t.idf;
    cover /= total;
    if (cover < 0.5) continue;
    const isPhrase = phrase.includes(' ') && idx.flat[id].includes(phrase);
    // shorter verses read as closer matches when everything else is equal
    const brevity = 0.05 * Math.max(0, 1 - idx.flat[id].length / 300);
    scored.push({
      id,
      book: BOOKS[idx.book[id]].osis,
      chapter: idx.chapter[id],
      verse: idx.verse[id],
      web: idx.web[id],
      meaning: meaning / total,
      score: cover + (isPhrase ? 1 : 0) + (eng / total) * 0.1 + brevity,
    });
  }
  scored.sort((a, b) => b.score - a.score);
  // the in-order bonus needs the verse's words: only worth working out for the leaders
  const top = scored.slice(0, 60);
  for (const c of top) c.score += 0.08 * wordingScore(ts, c.web, total).order;
  top.sort((a, b) => b.score - a.score);
  return top.slice(0, limit);
}

/** Step 2: score the candidates again in the reader's translation and keep the best `keep`. */
export function rankInTranslation(
  idx: Index,
  query: string,
  candidates: VerseCandidate[],
  texts: Map<number, string>,
  keep = 3,
): VerseHit[] {
  const ts = terms(idx, query);
  const total = ts.reduce((n, t) => n + t.idf, 0);
  const phrase = flatten(query);
  const hits: VerseHit[] = [];
  for (const c of candidates) {
    const text = texts.get(c.id) ?? c.web;
    const w = wordingScore(ts, text, total);
    const isPhrase = phrase.includes(' ') && flatten(text).includes(phrase);
    let kind: MatchKind | null = null;
    if (isPhrase) kind = 'phrase';
    else if (w.all) kind = 'all';
    else if (w.cover >= 0.6) kind = 'most';
    else if (c.meaning >= 0.7) kind = 'meaning';
    if (!kind) continue;
    const score =
      (isPhrase ? 3 : 0) + Math.max(w.cover, c.meaning * 0.8) + 0.08 * w.order + c.score * 0.25;
    hits.push({ book: c.book, chapter: c.chapter, verse: c.verse, text, kind, score });
  }
  hits.sort((a, b) => b.score - a.score);
  // only results close to the best: after an exact phrase, loose matches are just noise
  const best = hits[0]?.score ?? 0;
  return hits.filter((h) => h.score >= best * 0.6).slice(0, keep);
}

/** The words to bold in a result: those matching the search (by stem or a close spelling). */
export function matchedWords(query: string, text: string): Set<string> {
  const want = contentStems(query);
  const out = new Set<string>();
  for (const w of words(text)) {
    if (STOP_WORDS.has(w)) continue;
    const s = stem(w);
    if (want.some((t) => t === s || (t.length >= 5 && (s.startsWith(t) || within(t, s, t.length >= 8 ? 2 : 1)))))
      out.add(fold(w));
  }
  return out;
}
