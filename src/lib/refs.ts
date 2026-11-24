/**
 * Bible references written in notes: "John 3:16", "Rom 5:8", "1 Cor 13", "Matt 26:17-30", "Gen 1:1-2:3",
 * "Psalm 23". Found anywhere in a note and turned into links; also used for the passages of a notebook page
 * and to find which notes mention a verse.
 */
import { BOOKS, type Book } from '../data/books';
import { versesInChapter } from './bible';

/** A span of verses: from (chapter, verse) to (chapter, verse), in one book. */
export interface Span {
  osis: string;
  chapter: number;
  verse: number | null;
  toChapter: number;
  toVerse: number | null;
}

export interface FoundRef extends Span {
  start: number;
  end: number;
  text: string;
}

// Extra spellings people use; the book's own name and OSIS code always work too. Two-letter forms that are
// also ordinary words ("He", "Am", "Re"…) are left out so prose isn't turned into links.
const EXTRA: Record<string, string[]> = {
  Gen: ['Gn'], Exod: ['Exo', 'Ex'], Lev: ['Lv'], Num: ['Nm'], Deut: ['Dt', 'Deu'],
  Josh: ['Jos'], Judg: ['Jdg', 'Jg', 'Jdgs'], Ruth: ['Ru', 'Rth'], '1Sam': ['1 Sam', '1 Sa', '1 Sm'],
  '2Sam': ['2 Sam', '2 Sa', '2 Sm'], '1Kgs': ['1 Kgs', '1 Ki', '1 Kings', '1 Kin'], '2Kgs': ['2 Kgs', '2 Ki', '2 Kin'],
  '1Chr': ['1 Chr', '1 Ch', '1 Chron'], '2Chr': ['2 Chr', '2 Ch', '2 Chron'], Ezra: ['Ezr'], Neh: [],
  Esth: ['Est'], Job: ['Jb'], Ps: ['Psalm', 'Psa', 'Pss', 'Psm'], Prov: ['Pr', 'Prv', 'Pro'],
  Eccl: ['Ecc', 'Ec', 'Qoh'], Song: ['Song of Songs', 'SoS', 'Cant'], Isa: ['Is'], Jer: ['Jr'],
  Lam: [], Ezek: ['Eze', 'Ezk'], Dan: ['Dn'], Hos: [], Joel: ['Jl'], Amos: [], Obad: ['Oba'],
  Jonah: ['Jnh'], Mic: [], Nah: [], Hab: ['Hb'], Zeph: ['Zep', 'Zp'], Hag: ['Hg'], Zech: ['Zec', 'Zc'],
  Mal: ['Ml'], Matt: ['Mt', 'Mat'], Mark: ['Mk', 'Mrk'], Luke: ['Lk', 'Luk'], John: ['Jn', 'Jhn', 'Joh'],
  Acts: ['Act'], Rom: ['Ro', 'Rm'], '1Cor': ['1 Cor', '1 Co'], '2Cor': ['2 Cor', '2 Co'], Gal: [],
  Eph: ['Ephes'], Phil: ['Php', 'Pp'], Col: [], '1Thess': ['1 Thess', '1 Th', '1 Thes'],
  '2Thess': ['2 Thess', '2 Th', '2 Thes'], '1Tim': ['1 Tim', '1 Ti'], '2Tim': ['2 Tim', '2 Ti'], Titus: ['Tit'],
  Phlm: ['Philem', 'Phm', 'Phile'], Heb: [], Jas: ['Jm', 'Jam', 'Jms'], '1Pet': ['1 Pet', '1 Pe', '1 Pt'],
  '2Pet': ['2 Pet', '2 Pe', '2 Pt'], '1John': ['1 Jn', '1 Jhn', '1 Joh'], '2John': ['2 Jn', '2 Jhn'],
  '3John': ['3 Jn', '3 Jhn'], Jude: ['Jud', 'Jd'], Rev: ['Rv', 'Revelation', 'Apoc'],
};

const keyOf = (s: string) => s.toLowerCase().replace(/[\s.]+/g, '');
const NAMES = new Map<string, Book>();
for (const b of BOOKS) {
  for (const n of [b.name, b.osis, ...(EXTRA[b.osis] ?? [])]) NAMES.set(keyOf(n), b);
  // "1 Samuel" also as "1Samuel", "I Samuel"
  const m = /^([123]) (.+)$/.exec(b.name);
  if (m) NAMES.set(keyOf(`${'I'.repeat(Number(m[1]))} ${m[2]}`), b);
}

// Book-name pattern: longest names first so "1 John" wins over "John".
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s?');
const NAME_PATTERN = [...new Set([...BOOKS.flatMap((b) => [b.name, b.osis, ...(EXTRA[b.osis] ?? [])]), 'I Samuel', 'II Samuel', 'I Kings', 'II Kings', 'I Corinthians', 'II Corinthians', 'I John', 'II John', 'III John', 'I Peter', 'II Peter', 'I Timothy', 'II Timothy', 'I Thessalonians', 'II Thessalonians', 'I Chronicles', 'II Chronicles'])]
  .sort((a, b) => b.length - a.length)
  .map(escape)
  .join('|');

const DASH = '\\s*[-–—]\\s*';
const REF_RE = new RegExp(
  `(${NAME_PATTERN})\\.?\\s?(\\d{1,3})(?:\\s?:\\s?(\\d{1,3})(?:${DASH}(?:(\\d{1,3})\\s?:\\s?)?(\\d{1,3}))?|${DASH}(\\d{1,3})(?!\\s?:))?`,
  'gi',
);

/** Every Bible reference in a piece of writing. */
export function findRefs(text: string): FoundRef[] {
  const out: FoundRef[] = [];
  REF_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = REF_RE.exec(text))) {
    const prev = m.index > 0 ? text[m.index - 1] : '';
    if (/[A-Za-z0-9]/.test(prev)) continue; // inside a word ("Ebook 3")
    const name = m[1];
    const book = NAMES.get(keyOf(name)) ?? NAMES.get(keyOf(name.replace(/^(III|II|I)\s?/i, (r) => `${r.trim().length} `)));
    if (!book) continue;
    // short abbreviations ("is 3", "am 5") only count when capitalised, so ordinary words aren't linked
    const letters = name.replace(/[^A-Za-z]/g, '');
    if (letters.length <= 3 && !/[A-Z]/.test(letters[0] ?? '')) continue;
    const chapter = Number(m[2]);
    if (chapter < 1 || chapter > book.chapters) continue;
    let verse: number | null = m[3] ? Number(m[3]) : null;
    let toChapter = chapter;
    let toVerse: number | null = verse;
    if (m[5]) {
      toChapter = m[4] ? Number(m[4]) : chapter;
      toVerse = Number(m[5]);
    } else if (m[6]) {
      toChapter = Number(m[6]);
      if (toChapter < chapter || toChapter > book.chapters) toChapter = chapter;
    }
    if (verse != null && (verse < 1 || verse > versesInChapter(book.osis, chapter))) continue;
    if (toVerse != null && (toChapter < chapter || toVerse > versesInChapter(book.osis, toChapter) || (toChapter === chapter && toVerse < (verse ?? 1)))) {
      toChapter = chapter;
      toVerse = verse;
    }
    if (verse == null) toVerse = null;
    out.push({ start: m.index, end: m.index + m[0].length, text: m[0], osis: book.osis, chapter, verse, toChapter, toVerse });
  }
  return out;
}

/** "Matt.26.17-Matt.26.30", "Luke.22", "John.3.16" ⇄ a span */
export function spanFromOsis(s: string): Span | null {
  const [a, b] = s.split('-');
  const p = (x: string) => {
    const [osis, c, v] = x.split('.');
    return { osis, chapter: Number(c), verse: v ? Number(v) : null };
  };
  const from = p(a);
  if (!from.osis || !from.chapter) return null;
  const to = b ? p(b) : from;
  return { osis: from.osis, chapter: from.chapter, verse: from.verse, toChapter: to.chapter, toVerse: to.verse };
}

export function spanToOsis(s: Span): string {
  const a = `${s.osis}.${s.chapter}${s.verse != null ? `.${s.verse}` : ''}`;
  const same = s.toChapter === s.chapter && s.toVerse === s.verse;
  return same ? a : `${a}-${s.osis}.${s.toChapter}${s.toVerse != null ? `.${s.toVerse}` : ''}`;
}

/** "John 3:16–21", "Matthew 26:17–30", "Luke 22", "Genesis 1:1–2:3" */
export function spanLabel(s: Span): string {
  const book = BOOKS.find((b) => b.osis === s.osis);
  const name = book ? (book.osis === 'Ps' ? 'Psalm' : book.name) : s.osis;
  if (s.verse == null) return s.toChapter !== s.chapter ? `${name} ${s.chapter}–${s.toChapter}` : `${name} ${s.chapter}`;
  if (s.toChapter !== s.chapter) return `${name} ${s.chapter}:${s.verse}–${s.toChapter}:${s.toVerse}`;
  if (s.toVerse != null && s.toVerse !== s.verse) return `${name} ${s.chapter}:${s.verse}–${s.toVerse}`;
  return `${name} ${s.chapter}:${s.verse}`;
}

/** Does a span include this verse? (A chapter reference includes every verse in it.) */
export function spanCovers(s: Span, osis: string, chapter: number, verse: number): boolean {
  if (s.osis !== osis) return false;
  const at = chapter * 1000 + verse;
  const from = s.chapter * 1000 + (s.verse ?? 1);
  const to = s.toChapter * 1000 + (s.toVerse ?? 999);
  return at >= from && at <= to;
}

/** Passages typed in a box: "Matt 26:17-30; Luke 22" → spans (anything unrecognised is ignored). */
export function parsePassages(text: string): Span[] {
  return findRefs(text).map(({ osis, chapter, verse, toChapter, toVerse }) => ({ osis, chapter, verse, toChapter, toVerse }));
}

/** Book order, for sorting notes by where they are in the Bible. */
export const bookIndex = (osis: string) => BOOKS.findIndex((b) => b.osis === osis);
