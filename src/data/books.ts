export interface Book {
  /** OSIS code, e.g. "Gen", "1Cor" */
  osis: string;
  name: string;
  chapters: number;
  testament: 'OT' | 'NT';
}

const raw: [string, string, number][] = [
  ['Gen', 'Genesis', 50], ['Exod', 'Exodus', 40], ['Lev', 'Leviticus', 27], ['Num', 'Numbers', 36],
  ['Deut', 'Deuteronomy', 34], ['Josh', 'Joshua', 24], ['Judg', 'Judges', 21], ['Ruth', 'Ruth', 4],
  ['1Sam', '1 Samuel', 31], ['2Sam', '2 Samuel', 24], ['1Kgs', '1 Kings', 22], ['2Kgs', '2 Kings', 25],
  ['1Chr', '1 Chronicles', 29], ['2Chr', '2 Chronicles', 36], ['Ezra', 'Ezra', 10], ['Neh', 'Nehemiah', 13],
  ['Esth', 'Esther', 10], ['Job', 'Job', 42], ['Ps', 'Psalms', 150], ['Prov', 'Proverbs', 31],
  ['Eccl', 'Ecclesiastes', 12], ['Song', 'Song of Solomon', 8], ['Isa', 'Isaiah', 66], ['Jer', 'Jeremiah', 52],
  ['Lam', 'Lamentations', 5], ['Ezek', 'Ezekiel', 48], ['Dan', 'Daniel', 12], ['Hos', 'Hosea', 14],
  ['Joel', 'Joel', 3], ['Amos', 'Amos', 9], ['Obad', 'Obadiah', 1], ['Jonah', 'Jonah', 4],
  ['Mic', 'Micah', 7], ['Nah', 'Nahum', 3], ['Hab', 'Habakkuk', 3], ['Zeph', 'Zephaniah', 3],
  ['Hag', 'Haggai', 2], ['Zech', 'Zechariah', 14], ['Mal', 'Malachi', 4],
  ['Matt', 'Matthew', 28], ['Mark', 'Mark', 16], ['Luke', 'Luke', 24], ['John', 'John', 21],
  ['Acts', 'Acts', 28], ['Rom', 'Romans', 16], ['1Cor', '1 Corinthians', 16], ['2Cor', '2 Corinthians', 13],
  ['Gal', 'Galatians', 6], ['Eph', 'Ephesians', 6], ['Phil', 'Philippians', 4], ['Col', 'Colossians', 4],
  ['1Thess', '1 Thessalonians', 5], ['2Thess', '2 Thessalonians', 3], ['1Tim', '1 Timothy', 6],
  ['2Tim', '2 Timothy', 4], ['Titus', 'Titus', 3], ['Phlm', 'Philemon', 1], ['Heb', 'Hebrews', 13],
  ['Jas', 'James', 5], ['1Pet', '1 Peter', 5], ['2Pet', '2 Peter', 3], ['1John', '1 John', 5],
  ['2John', '2 John', 1], ['3John', '3 John', 1], ['Jude', 'Jude', 1], ['Rev', 'Revelation', 22],
];

export const BOOKS: Book[] = raw.map(([osis, name, chapters], i) => ({
  osis,
  name,
  chapters,
  testament: i < 39 ? 'OT' : 'NT',
}));

const byOsis = new Map(BOOKS.map((b) => [b.osis, b]));

export function getBook(osis: string): Book {
  const b = byOsis.get(osis);
  if (!b) throw new Error(`Unknown book: ${osis}`);
  return b;
}

/** 1-based canonical book number (Protestant order), used by some APIs. */
export function bookNumber(osis: string): number {
  return BOOKS.findIndex((b) => b.osis === osis) + 1;
}
