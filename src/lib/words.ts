/**
 * Hebrew & Greek word study data from STEPBible (Tyndale House, Cambridge), CC BY 4.0.
 * Built by scripts/build-words.mjs; everything here loads on demand.
 */

export interface Word {
  /** the word as written (Hebrew or Greek) */
  word: string;
  translit: string;
  gloss: string;
  /** extended Strong's number, e.g. "H7225G" or "G0025" */
  strong: string;
  /** grammar code, e.g. "HVqp3ms" or "V-AAI-3S" (Hebrew prefixes separated by "/") */
  grammar: string;
  /** only in the Greek text behind the KJV (Textus Receptus), not in modern editions */
  kjvOnly: boolean;
}

/** A lexicon definition: plain, bold or italic text, line breaks, and verse links. */
export type DefSegment = [string] | [string, 'b' | 'i'] | [string, 'r', string];

export interface LexEntry {
  strong: string;
  lemma: string;
  translit: string;
  gloss: string;
  definition: DefSegment[];
  /** number of verses using this word */
  verseCount: number;
  /** the first verses using it (up to 250) */
  refs: string[];
}

const base = import.meta.env.BASE_URL;
const chapterCache = new Map<string, Promise<Record<string, (string | number)[][]>>>();
const shardCache = new Map<string, Promise<Record<string, [string, string, string, DefSegment[], number, string[]]>>>();
const grammarCache = new Map<string, Promise<Record<string, string>>>();

const getJson = <T,>(url: string, fallback: T): Promise<T> =>
  fetch(url)
    .then((r) => (r.ok ? (r.json() as Promise<T>) : fallback))
    .catch(() => fallback);

export async function loadVerseWords(book: string, chapter: number, verse: number): Promise<Word[]> {
  const key = `${book}/${chapter}`;
  let p = chapterCache.get(key);
  if (!p) chapterCache.set(key, (p = getJson(`${base}data/words/${book}/${chapter}.json`, {})));
  const rows = (await p)[String(verse)] ?? [];
  return rows.map(([word, translit, gloss, strong, grammar, kjv]) => ({
    word: String(word),
    translit: String(translit),
    gloss: String(gloss),
    strong: String(strong),
    grammar: String(grammar),
    kjvOnly: kjv === 1,
  }));
}

/** Dictionary entry for an extended Strong's number; falls back to another entry with the same number. */
export async function loadLexEntry(strong: string): Promise<LexEntry | null> {
  if (!/^[HG]\d{4}/.test(strong)) return null;
  const shard = `${strong[0]}${Math.floor(Number(strong.slice(1, 5)) / 500)}`;
  let p = shardCache.get(shard);
  if (!p) shardCache.set(shard, (p = getJson(`${base}data/lexicon/${shard}.json`, {})));
  const data = await p;
  const key = data[strong] ? strong : Object.keys(data).find((k) => k.slice(0, 5) === strong.slice(0, 5));
  if (!key) return null;
  const [lemma, translit, gloss, definition, verseCount, refs] = data[key];
  return { strong: key, lemma, translit, gloss, definition, verseCount, refs };
}

/** Plain-English grammar, e.g. "Verb · Aorist · Active · Indicative · 3rd person · Singular". */
export async function describeGrammar(code: string, strong: string): Promise<string> {
  if (!code) return '';
  const lang = strong.startsWith('H') ? 'H' : 'G';
  let p = grammarCache.get(lang);
  if (!p) grammarCache.set(lang, (p = getJson(`${base}data/grammar-${lang}.json`, {})));
  const map = await p;
  if (lang === 'G') return map[code] ?? code;
  // Hebrew: "HR/Ncfsa" is a prefix (preposition) plus the main word; each part is explained
  const prefix = code[0];
  return code
    .split('/')
    .map((part, i) => map[i === 0 ? part : prefix + part] ?? part)
    .join(' + ');
}

/** "H7225G" → "H7225"; "G0025" → "G25" (the usual way Strong's numbers are written) */
export const strongLabel = (s: string) => `${s[0]}${Number(s.slice(1, 5))}`;

/** Does this word share a dictionary entry with that one (ignoring the extended letter)? */
export const sameRoot = (a: string, b: string) => a.slice(0, 5) === b.slice(0, 5);

/** Gloss with the translators' markers made readable: "<the>" (untranslated article) → "(the)". */
export const cleanGloss = (g: string) => g.replace(/<([^>]*)>/g, '($1)');
