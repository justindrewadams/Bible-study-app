import { bookNumber, getBook } from '../data/books';
import verseCounts from '../data/verseCounts.json';
import { APIBIBLE_ENABLED, ESV_RELAY_URL } from '../config';

export interface Verse {
  verse: number;
  text: string;
}

export interface Translation {
  /** unique id: "<provider>:<code>" */
  id: string;
  provider: 'bibleapi' | 'bolls' | 'esv' | 'apibible';
  code: string;
  name: string;
  /** required credit, shown under the text */
  notice?: string;
  /** a shorter abbreviation for tight spaces (the phone header) */
  label?: string;
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

/** Freely licensed (e.g. CC BY) translations; none at the moment. */
export const OPEN_TRANSLATIONS: Translation[] = [];

/**
 * Copyrighted translations served by API.Bible under its free, non-commercial Starter plan
 * (https://api.bible/terms-and-conditions), through the app's relay, which holds the key and keeps
 * each chapter in Cloudflare for at most 30 days (refreshed after 25). On this side: text is kept
 * in memory only, every view is reported to API.Bible's usage tracking (FUMS), the copyright
 * notice and a link to API.Bible appear under the text, and printing stops at 100 verses.
 * `notice` is the publisher's standard notice, replaced by the one API.Bible sends when it does.
 */
const ALL_APIBIBLE_TRANSLATIONS: Translation[] = [
  {
    id: 'apibible:NASB1995',
    provider: 'apibible',
    code: 'NASB1995',
    label: 'NASB95',
    name: 'New American Standard Bible (1995)',
    notice:
      'Scripture quotations taken from the (NASB®) New American Standard Bible®, Copyright © 1960, 1971, 1977, 1995 by The Lockman Foundation. Used by permission. All rights reserved. lockman.org',
  },
  {
    id: 'apibible:CSB',
    provider: 'apibible',
    code: 'CSB',
    name: 'Christian Standard Bible',
    notice:
      'Scripture quotations marked CSB have been taken from the Christian Standard Bible®, Copyright © 2017 by Holman Bible Publishers. Used by permission. Christian Standard Bible® and CSB® are federally registered trademarks of Holman Bible Publishers.',
  },
  {
    id: 'apibible:NKJV',
    provider: 'apibible',
    code: 'NKJV',
    name: 'New King James Version',
    notice: 'Scripture taken from the New King James Version®. Copyright © 1982 by Thomas Nelson. Used by permission. All rights reserved.',
  },
];

/** Offered once the relay is set up for API.Bible (APIBIBLE_ENABLED in config.ts). */
export const APIBIBLE_TRANSLATIONS = APIBIBLE_ENABLED ? ALL_APIBIBLE_TRANSLATIONS : [];

/** The ESV and the API.Bible translations: copyrighted, shown under their publishers' terms. */
export const isLicensed = (t: Translation) => t.provider === 'esv' || t.provider === 'apibible';

/** The copyright notice API.Bible sent for each translation (kept for the session). */
const apiBibleNotices = new Map<string, string>();
/** The notice to show under a translation's text. */
export function translationNotice(t: Translation): string {
  if (t.provider === 'esv') return ESV_COPYRIGHT;
  return apiBibleNotices.get(t.code) || t.notice || `${t.name}, public domain.`;
}

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
  return [...BIBLE_API_TRANSLATIONS, ...OPEN_TRANSLATIONS, ...APIBIBLE_TRANSLATIONS, ESV_TRANSLATION].find((t) => t.id === id) ?? ESV_TRANSLATION;
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

/** A licensed translation can't be fetched right now (the app shows the WEB instead). */
export class LicensedUnavailable extends Error {}
export class EsvKeyMissing extends LicensedUnavailable {}

// --- API.Bible (NASB 1995, CSB, NKJV) --------------------------------------------------------

/**
 * Chapters are kept in memory only (never in browser storage), at most 500 verses, like the ESV.
 * Each keeps API.Bible's FUMS token, reported every time the chapter is shown.
 */
const apiBibleCache = new Map<string, { verses: Verse[]; fums: string }>();
function apiBibleSet(key: string, v: { verses: Verse[]; fums: string }) {
  apiBibleCache.set(key, v);
  let total = [...apiBibleCache.values()].reduce((n, x) => n + x.verses.length, 0);
  for (const k of apiBibleCache.keys()) {
    if (total <= 500 || k === key) break;
    total -= apiBibleCache.get(k)!.verses.length;
    apiBibleCache.delete(k);
  }
}

type FumsWindow = Window & { fums?: (...args: unknown[]) => void; fumsData?: unknown[] };
/** Reports one view to API.Bible's Fair Use Management System, loading its script the first time. */
function reportView(token: string) {
  if (!token || typeof window === 'undefined') return;
  const w = window as FumsWindow;
  if (!w.fums) {
    w.fumsData = w.fumsData || [];
    w.fums = function (...args: unknown[]) {
      w.fumsData!.push(args);
    };
    const s = document.createElement('script');
    s.src = 'https://pkg.api.bible/fumsV3.min.js';
    s.async = true;
    document.head.appendChild(s);
  }
  w.fums('trackView', token);
}

async function fetchApiBible(t: Translation, osis: string, chapter: number): Promise<Verse[]> {
  const key = `${t.code}:${osis}.${chapter}`;
  let hit = apiBibleCache.get(key);
  if (!hit) {
    if (!ESV_RELAY_ENABLED) throw new LicensedUnavailable('the relay is not set up');
    const params = new URLSearchParams({ bible: t.code, book: osis, chapter: String(chapter) });
    let res: Response;
    try {
      res = await fetch(`${ESV_RELAY_URL.replace(/\/$/, '')}/abible?${params}`);
    } catch {
      throw new LicensedUnavailable('no connection');
    }
    const data = (await res.json().catch(() => ({}))) as { verses?: Verse[]; copyright?: string; fums?: string; error?: string };
    if (!res.ok || !data.verses?.length) throw new LicensedUnavailable(data.error ?? `the relay returned ${res.status}`);
    if (data.copyright) apiBibleNotices.set(t.code, data.copyright.replace(/\s+/g, ' ').trim());
    hit = { verses: data.verses.map((v) => ({ verse: v.verse, text: clean(v.text) })), fums: data.fums ?? '' };
    apiBibleSet(key, hit);
  }
  reportView(hit.fums);
  return hit.verses;
}

/** True when the app can read the ESV for everyone, through the relay. */
export const ESV_RELAY_ENABLED = ESV_RELAY_URL.trim() !== '';

function toVerses(passages: string[]): Verse[] {
  const parts = passages.join(' ').split(/\[(\d+)\]/);
  const verses: Verse[] = [];
  for (let i = 1; i < parts.length; i += 2) {
    verses.push({ verse: Number(parts[i]), text: clean(parts[i + 1] ?? '') });
  }
  return verses;
}

/** Through the relay, which holds the app's key (relay/esv-relay.js). */
async function fetchEsvViaRelay(osis: string, chapter: number, from: number, to: number): Promise<Verse[]> {
  const params = new URLSearchParams({ book: osis, chapter: String(chapter), from: String(from), to: String(to) });
  const res = await fetch(`${ESV_RELAY_URL.replace(/\/$/, '')}/passage?${params}`);
  const data = (await res.json().catch(() => ({}))) as { passages?: string[]; error?: string };
  if (res.status === 429) throw new Error('The ESV service is busy (daily or hourly limit reached). Please try again later.');
  if (!res.ok) throw new EsvKeyMissing(data.error ?? `The ESV relay returned ${res.status}.`);
  return toVerses(data.passages ?? []);
}

async function fetchEsv(osis: string, chapter: number, from: number, to: number, apiKey: string): Promise<Verse[]> {
  // a reader's own key goes straight to Crossway; otherwise use the app's relay
  if (!apiKey && ESV_RELAY_ENABLED) return fetchEsvViaRelay(osis, chapter, from, to);
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
  return toVerses(data.passages ?? []);
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
  if (t.provider === 'apibible') return fetchApiBible(t, osis, chapter);
  const key = `${t.id}:${osis}.${chapter}`;
  const hit = pdGet(key);
  if (hit) return hit;
  const verses = t.provider === 'bolls' ? await fetchBolls(t, osis, chapter) : await fetchBibleApi(t, osis, chapter);
  pdSet(key, verses);
  return verses;
}

// --- a few scattered verses (for verse search) ---------------------------------------------

/** "Rom.3.23" */
export type VerseRef = string;

/** Matches Crossway's canonical reference for one verse (e.g. "Psalm 23:1") against our OSIS reference. */
const canonicalOf = (osis: VerseRef) => {
  const [b, c, v] = osis.split('.');
  return `${b === 'Ps' ? 'Psalm' : getBook(b).name} ${c}:${v}`;
};

async function fetchEsvVerses(refs: VerseRef[], apiKey: string): Promise<Map<VerseRef, string>> {
  let data: { passages?: string[]; canonical?: string[]; passage_meta?: { canonical: string }[]; error?: string };
  if (!apiKey && ESV_RELAY_ENABLED) {
    const res = await fetch(`${ESV_RELAY_URL.replace(/\/$/, '')}/verses?refs=${refs.join(',')}`);
    data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error ?? `The ESV relay returned ${res.status}.`);
  } else if (apiKey) {
    const params = new URLSearchParams({
      q: refs.map(canonicalOf).join('; '),
      'include-headings': 'false',
      'include-footnotes': 'false',
      'include-verse-numbers': 'false',
      'include-first-verse-numbers': 'false',
      'include-short-copyright': 'false',
      'include-copyright': 'false',
      'include-passage-references': 'false',
    });
    const res = await fetch(`https://api.esv.org/v3/passage/text/?${params}`, { headers: { Authorization: `Token ${apiKey}` } });
    if (!res.ok) throw new Error(`ESV API returned ${res.status}`);
    data = await res.json();
  } else throw new EsvKeyMissing('No ESV API key is set up yet.');
  const passages = data.passages ?? [];
  const names = data.canonical ?? data.passage_meta?.map((m) => m.canonical) ?? [];
  const out = new Map<VerseRef, string>();
  refs.forEach((r, i) => {
    // by name when Crossway says which passage is which, otherwise by order (only when the counts agree)
    const at = names.length ? names.findIndex((n) => n.replace(/^Psalms /, 'Psalm ') === canonicalOf(r)) : passages.length === refs.length ? i : -1;
    const text = at >= 0 ? clean(passages[at] ?? '') : '';
    if (text) out.set(r, text);
  });
  return out;
}

async function fetchBibleApiVerses(t: Translation, refs: VerseRef[]): Promise<Map<VerseRef, string>> {
  // bible-api.com takes several verses of one book per request ("Romans 3:23,5:8")
  const byBook = new Map<string, VerseRef[]>();
  for (const r of refs) {
    const b = r.split('.')[0];
    byBook.set(b, [...(byBook.get(b) ?? []), r]);
  }
  const out = new Map<VerseRef, string>();
  await Promise.all(
    [...byBook].map(async ([b, rs]) => {
      const q = encodeURIComponent(`${getBook(b).name} ${rs.map((r) => r.split('.').slice(1).join(':')).join(',')}`);
      const res = await fetch(`https://bible-api.com/${q}?translation=${t.code}`);
      if (!res.ok) throw new Error(`bible-api.com returned ${res.status}`);
      const data = (await res.json()) as { verses: { chapter: number; verse: number; text: string }[] };
      for (const v of data.verses ?? []) out.set(`${b}.${v.chapter}.${v.verse}`, clean(v.text));
    }),
  );
  return out;
}

/**
 * The text of a few single verses in a translation (at most 6: what verse search shows). ESV verses go
 * through the same memory-only cache as chapters, so the 500-verse limit on the device still holds.
 */
export async function fetchVerses(t: Translation, refs: VerseRef[], opts: { esvKey?: string } = {}): Promise<Map<VerseRef, string>> {
  const out = new Map<VerseRef, string>();
  const key = (r: VerseRef) => {
    const [b, c, v] = r.split('.');
    return t.provider === 'esv' ? `${b}.${c}:${v}-${v}` : `${t.id}:${b}.${c}:${v}`;
  };
  const missing: VerseRef[] = [];
  if (t.provider === 'apibible') {
    // whole chapters through the relay's store, so verse search costs no extra API.Bible calls
    for (const r of refs.slice(0, 6)) {
      const [b, c, v] = r.split('.');
      const text = (await fetchApiBible(t, b, Number(c))).find((x) => x.verse === Number(v))?.text;
      if (text) out.set(r, text);
    }
    return out;
  }
  for (const r of refs.slice(0, 6)) {
    const hit = t.provider === 'esv' ? esvGet(key(r)) : pdGet(key(r));
    if (hit?.[0]) out.set(r, hit[0].text);
    else missing.push(r);
  }
  if (!missing.length) return out;
  let got: Map<VerseRef, string>;
  if (t.provider === 'esv') got = await fetchEsvVerses(missing, opts.esvKey ?? '');
  else if (t.provider === 'bibleapi') got = await fetchBibleApiVerses(t, missing);
  else {
    got = new Map();
    for (const r of missing) {
      const [b, c, v] = r.split('.');
      const ch = await fetchPassage(t, b, Number(c), { from: 1, to: 999 }, opts);
      const text = ch.find((x) => x.verse === Number(v))?.text;
      if (text) got.set(r, text);
    }
  }
  for (const [r, text] of got) {
    const v = [{ verse: Number(r.split('.')[2]), text }];
    if (t.provider === 'esv') esvSet(key(r), v);
    else pdSet(key(r), v);
    out.set(r, text);
  }
  return out;
}
