import { getBook, bookNumber } from '../data/books';

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
}

/** Public-domain translations served by bible-api.com (no key, CORS enabled). */
export const BIBLE_API_TRANSLATIONS: Translation[] = [
  ['kjv', 'King James Version'],
  ['web', 'World English Bible'],
  ['asv', 'American Standard Version (1901)'],
  ['bbe', 'Bible in Basic English'],
  ['darby', 'Darby Bible'],
  ['ylt', "Young's Literal Translation"],
  ['oeb-us', 'Open English Bible'],
].map(([code, name]) => ({ id: `bibleapi:${code}`, provider: 'bibleapi', code, name }));

/** Fallback list for bolls.life if its catalog can't be loaded. */
const BOLLS_FALLBACK: [string, string][] = [
  ['NIV', 'New International Version'],
  ['ESV', 'English Standard Version'],
  ['NKJV', 'New King James Version'],
  ['NLT', 'New Living Translation'],
  ['NASB', 'New American Standard Bible'],
  ['CSB17', 'Christian Standard Bible'],
  ['AMP', 'Amplified Bible'],
  ['MSG', 'The Message'],
];

export const ESV_TRANSLATION: Translation = {
  id: 'esv:ESV',
  provider: 'esv',
  code: 'ESV',
  name: 'English Standard Version (official ESV API — needs free key)',
};

const toBolls = ([code, name]: [string, string]): Translation => ({
  id: `bolls:${code}`,
  provider: 'bolls',
  code,
  name,
});

let bollsCatalog: Promise<Translation[]> | null = null;

/** English translations offered by bolls.life (includes modern copyrighted versions). */
export function loadBollsTranslations(): Promise<Translation[]> {
  bollsCatalog ??= fetch('https://bolls.life/static/bolls/app/views/languages.json')
    .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
    .then((langs: { language: string; translations: { short_name: string; full_name: string }[] }[]) => {
      const en = langs.find((l) => /english/i.test(l.language));
      if (!en?.translations?.length) throw new Error('no english');
      return en.translations.map((t) => toBolls([t.short_name, t.full_name]));
    })
    .catch(() => BOLLS_FALLBACK.map(toBolls));
  return bollsCatalog;
}

export function findTranslation(id: string, extra: Translation[]): Translation {
  return (
    [...BIBLE_API_TRANSLATIONS, ESV_TRANSLATION, ...extra].find((t) => t.id === id) ??
    (id.startsWith('bolls:') ? toBolls([id.slice(6), id.slice(6)]) : BIBLE_API_TRANSLATIONS[0])
  );
}

const memCache = new Map<string, Verse[]>();
const CACHE_PREFIX = 'chapter:';

function cacheGet(key: string): Verse[] | null {
  if (memCache.has(key)) return memCache.get(key)!;
  try {
    const s = sessionStorage.getItem(CACHE_PREFIX + key);
    if (s) {
      const v = JSON.parse(s) as Verse[];
      memCache.set(key, v);
      return v;
    }
  } catch {
    /* storage unavailable */
  }
  return null;
}

function cacheSet(key: string, verses: Verse[]) {
  memCache.set(key, verses);
  try {
    sessionStorage.setItem(CACHE_PREFIX + key, JSON.stringify(verses));
  } catch {
    /* quota or unavailable */
  }
}

const clean = (s: string) =>
  s
    .replace(/<S>\d+<\/S>/g, '') // Strong's numbers (bolls)
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
  if (!Array.isArray(data) || !data.length) throw new Error(`${t.code} has no text for this chapter`);
  return data.map((v) => ({ verse: v.verse, text: clean(v.text) }));
}

async function fetchEsv(osis: string, chapter: number, apiKey: string): Promise<Verse[]> {
  if (!apiKey) throw new Error('Add your free ESV API key in Settings (api.esv.org) to use the official ESV.');
  const book = getBook(osis);
  const params = new URLSearchParams({
    q: `${book.name} ${chapter}`,
    'include-headings': 'false',
    'include-footnotes': 'false',
    'include-verse-numbers': 'true',
    'include-short-copyright': 'false',
    'include-passage-references': 'false',
    'include-first-verse-numbers': 'true',
  });
  const res = await fetch(`https://api.esv.org/v3/passage/text/?${params}`, {
    headers: { Authorization: `Token ${apiKey}` },
  });
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

export async function fetchChapter(
  t: Translation,
  osis: string,
  chapter: number,
  opts: { esvKey?: string } = {},
): Promise<Verse[]> {
  const key = `${t.id}:${osis}.${chapter}`;
  const hit = cacheGet(key);
  if (hit) return hit;
  let verses: Verse[];
  if (t.provider === 'bibleapi') verses = await fetchBibleApi(t, osis, chapter);
  else if (t.provider === 'bolls') verses = await fetchBolls(t, osis, chapter);
  else verses = await fetchEsv(osis, chapter, opts.esvKey ?? '');
  cacheSet(key, verses);
  return verses;
}
