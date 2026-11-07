import { bookNumber, getBook } from '../data/books';
import verseCounts from '../data/verseCounts.json';

export interface Verse {
  verse: number;
  text: string;
}

export interface Translation {
  /** unique id: "<provider>:<code>" */
  id: string;
  provider: 'bibleapi' | 'bolls' | 'esv';
  code: string;
  name: string;
  /** required credit, shown under the text */
  notice?: string;
}

/**
 * Public-domain translations, served by bible-api.com (no key, CORS enabled). Being in the
 * public domain, these can be displayed, cached and shared without limits.
 */
export const BIBLE_API_TRANSLATIONS: Translation[] = [
  ['web', 'World English Bible'],
  ['kjv', 'King James Version'],
  ['asv', 'American Standard Version (1901)'],
  ['bbe', 'Bible in Basic English'],
  ['darby', 'Darby Bible'],
  ['ylt', "Young's Literal Translation"],
  ['oeb-us', 'Open English Bible'],
].map(([code, name]) => ({ id: `bibleapi:${code}`, provider: 'bibleapi', code, name }));

/**
 * Copyrighted translations other than the ESV (e.g. NASB, LSB, NKJV, HCSB) are not offered:
 * their publishers allow only limited quotation without permission, so showing whole
 * chapters needs a license or an official licensed source (for example API.Bible).
 */
export const OPEN_TRANSLATIONS: Translation[] = [];

/**
 * The ESV, only through Crossway's official ESV API (api.esv.org), under its free
 * non-commercial terms. See ESV_TERMS below for how the app keeps to them.
 */
export const ESV_TRANSLATION: Translation = {
  id: 'esv:ESV',
  provider: 'esv',
  code: 'ESV',
  name: 'English Standard Version',
};

/** What a new visitor reads. */
export const DEFAULT_TRANSLATION = ESV_TRANSLATION.id;
/** Used when the ESV can't be (no key configured, or the API is unavailable). */
export const FALLBACK_TRANSLATION = 'bibleapi:web';


/** Crossway's required notice for the ESV (shown under ESV text and in Sources & licenses). */
export const ESV_COPYRIGHT =
  'Scripture quotations are from the ESV® Bible (The Holy Bible, English Standard Version®), © 2001 by Crossway, a publishing ministry of Good News Publishers. Used by permission. All rights reserved.';

export const ESV_TERMS = {
  /** never more than this many verses on screen at once… */
  maxVersesPerPage: 500,
  /** …nor more than half of the book */
  maxBookFraction: 0.5,
  /** never more than this many ESV verses stored on the device */
  maxCachedVerses: 500,
};

export function findTranslation(id: string): Translation {
  return [...BIBLE_API_TRANSLATIONS, ...OPEN_TRANSLATIONS, ESV_TRANSLATION].find((t) => t.id === id) ?? ESV_TRANSLATION;
}

const counts = verseCounts as Record<string, number[]>;

export function versesInChapter(osis: string, chapter: number): number {
  return counts[osis]?.[chapter - 1] ?? 0;
}

/**
 * Splits a chapter into screens that respect a licensed translation's per-page limit:
 * at most 500 verses and at most half of the book. Most chapters are a single screen; a
 * one-chapter book like Jude (25 verses) becomes two screens of 12 and 13 verses.
 */
export function chapterPages(t: Translation, osis: string, chapter: number): { from: number; to: number }[] {
  const n = versesInChapter(osis, chapter);
  if (!n) return [{ from: 1, to: 999 }];
  if (t.provider !== 'esv') return [{ from: 1, to: n }];
  const bookTotal = (counts[osis] ?? []).reduce((a, b) => a + b, 0);
  const max = Math.max(1, Math.min(ESV_TERMS.maxVersesPerPage, Math.floor(bookTotal * ESV_TERMS.maxBookFraction)));
  if (n <= max) return [{ from: 1, to: n }];
  const parts = Math.ceil(n / max);
  const size = Math.ceil(n / parts);
  return Array.from({ length: parts }, (_, i) => ({ from: i * size + 1, to: Math.min(n, (i + 1) * size) }));
}

// --- caching -------------------------------------------------------------------------

const pdCache = new Map<string, Verse[]>();
const PD_PREFIX = 'chapter:';

function pdGet(key: string): Verse[] | null {
  if (pdCache.has(key)) return pdCache.get(key)!;
  try {
    const s = sessionStorage.getItem(PD_PREFIX + key);
    if (s) {
      const v = JSON.parse(s) as Verse[];
      pdCache.set(key, v);
      return v;
    }
  } catch {
    /* storage unavailable */
  }
  return null;
}

function pdSet(key: string, verses: Verse[]) {
  pdCache.set(key, verses);
  try {
    sessionStorage.setItem(PD_PREFIX + key, JSON.stringify(verses));
  } catch {
    /* quota or unavailable */
  }
}

/**
 * ESV text is kept in memory only (never written to browser storage), and the oldest
 * passages are dropped so no more than 500 ESV verses are ever held on the device.
 */
const esvCache = new Map<string, Verse[]>();
function esvGet(key: string): Verse[] | null {
  const v = esvCache.get(key);
  if (!v) return null;
  esvCache.delete(key); // refresh recency
  esvCache.set(key, v);
  return v;
}
function esvSet(key: string, verses: Verse[]) {
  esvCache.set(key, verses);
  let total = [...esvCache.values()].reduce((n, v) => n + v.length, 0);
  for (const k of esvCache.keys()) {
    if (total <= ESV_TERMS.maxCachedVerses || k === key) break;
    total -= esvCache.get(k)!.length;
    esvCache.delete(k);
  }
}
/** Clean up anything an older version of the app may have stored. */
try {
  for (let i = sessionStorage.length - 1; i >= 0; i--) {
    const k = sessionStorage.key(i);
    // ESV text and copyrighted versions an older version of the app showed (the LSV may stay)
    if (k && /^chapter:(esv:|bolls:(?!LSV:))/.test(k)) sessionStorage.removeItem(k);
  }
} catch {
  /* storage unavailable */
}

// --- fetching ------------------------------------------------------------------------

const clean = (s: string) =>
  s
    .replace(/<S>\d+<\/S>/g, '') // Strong's numbers
    .replace(/<sup>.*?<\/sup>/g, '') // footnote markers
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();

async function fetchBibleApi(t: Translation, osis: string, chapter: number): Promise<Verse[]> {
  const book = getBook(osis);
  const q = encodeURIComponent(`${book.name} ${chapter}`);
  const res = await fetch(`https://bible-api.com/${q}?translation=${t.code}`);
  if (!res.ok) throw new Error(`bible-api.com returned ${res.status}`);
  const data = (await res.json()) as { verses: { verse: number; text: string }[] };
  return data.verses.map((v) => ({ verse: v.verse, text: clean(v.text) }));
}

async function fetchBolls(t: Translation, osis: string, chapter: number): Promise<Verse[]> {
  const res = await fetch(`https://bolls.life/get-text/${t.code}/${bookNumber(osis)}/${chapter}/`);
  if (!res.ok) throw new Error(`bolls.life returned ${res.status}`);
  const data = (await res.json()) as { verse: number; text: string }[];
  if (!Array.isArray(data) || !data.length) throw new Error(`The ${t.code} has no text for this chapter.`);
  return data.map((v) => ({ verse: v.verse, text: clean(v.text) }));
}

export class EsvKeyMissing extends Error {}

async function fetchEsv(osis: string, chapter: number, from: number, to: number, apiKey: string): Promise<Verse[]> {
  if (!apiKey) throw new EsvKeyMissing('No ESV API key is set up yet.');
  const book = getBook(osis);
  const params = new URLSearchParams({
    q: `${book.name} ${chapter}:${from}-${to}`,
    'include-headings': 'false',
    'include-footnotes': 'false',
    'include-verse-numbers': 'true',
    'include-first-verse-numbers': 'true',
    'include-short-copyright': 'false',
    'include-copyright': 'false', // the full notice is shown by the app under the text
    'include-passage-references': 'false',
  });
  const res = await fetch(`https://api.esv.org/v3/passage/text/?${params}`, {
    headers: { Authorization: `Token ${apiKey}` },
  });
  if (res.status === 401 || res.status === 403) throw new EsvKeyMissing('The ESV API key was not accepted.');
  if (res.status === 429) throw new Error('The ESV service is busy (daily or hourly limit reached). Please try again later.');
  if (!res.ok) throw new Error(`ESV API returned ${res.status}`);
  const data = (await res.json()) as { passages: string[] };
  const text = (data.passages ?? []).join(' ');
  const parts = text.split(/\[(\d+)\]/);
  const verses: Verse[] = [];
  for (let i = 1; i < parts.length; i += 2) {
    verses.push({ verse: Number(parts[i]), text: clean(parts[i + 1] ?? '') });
  }
  return verses;
}

/** One screen of text: the whole chapter, or for the ESV, the part allowed on one page. */
export async function fetchPassage(
  t: Translation,
  osis: string,
  chapter: number,
  page: { from: number; to: number },
  opts: { esvKey?: string } = {},
): Promise<Verse[]> {
  if (t.provider === 'esv') {
    const key = `${osis}.${chapter}:${page.from}-${page.to}`;
    const hit = esvGet(key);
    if (hit) return hit;
    const verses = await fetchEsv(osis, chapter, page.from, page.to, opts.esvKey ?? '');
    esvSet(key, verses);
    return verses;
  }
  const key = `${t.id}:${osis}.${chapter}`;
  const hit = pdGet(key);
  if (hit) return hit;
  const verses = t.provider === 'bolls' ? await fetchBolls(t, osis, chapter) : await fetchBibleApi(t, osis, chapter);
  pdSet(key, verses);
  return verses;
}
