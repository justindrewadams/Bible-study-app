import raw from '../data/lists.json';

export interface ListItem {
  t: string;
  ref: string; // OSIS
  note?: string;
  /** e.g. reign dates */
  meta?: string;
  /** kings: the Bible's verdict on their reign */
  tag?: 'good' | 'evil';
  place?: string;
  lat?: number;
  lon?: number;
  placeIndex?: number | null;
}

export interface StudyList {
  id: string;
  title: string;
  group: 'Old Testament' | 'Whole Bible' | 'New Testament';
  color: string;
  summary: string;
  note?: string;
  items: ListItem[];
}

export const LISTS = raw as StudyList[];

export const LIST_GROUPS = ['Old Testament', 'Whole Bible', 'New Testament'] as const;

/** Lists + item indexes whose reference is this verse. */
export function listsAtVerse(book: string, chapter: number, verse: number) {
  const key = `${book}.${chapter}.${verse}`;
  const out: { list: StudyList; index: number }[] = [];
  for (const l of LISTS) {
    const i = l.items.findIndex((it) => it.ref === key);
    if (i >= 0) out.push({ list: l, index: i });
  }
  return out;
}
