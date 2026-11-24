import raw from '../data/lists.json';

export interface ListItem {
  t: string;
  ref: string; // OSIS
  note?: string;
  /** e.g. reign dates */
  meta?: string;
  /** kings: the Bible's verdict on their reign */
  tag?: 'good' | 'evil';
  /** words to mark inside the verse when several items share it (first match wins; covers other translations' wording) */
  words?: string[];
  place?: string;
  lat?: number;
  lon?: number;
  placeIndex?: number | null;
  /** an approximate territory to shade on the map: one or more outlines of [lat, lon] points */
  area?: [number, number][][];
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

/** Your own study lists (signed in): ids start with "my:". Set by the app from your notes. */
let mine: StudyList[] = [];
export function setMyLists(list: StudyList[]) {
  mine = list;
}
/** Lists that came with a shared lesson someone opened (ids start with "shared:"). */
let shared: StudyList[] = [];
export function setSharedLists(list: StudyList[]) {
  shared = list;
}
/** Your own lists first, then any from an open shared lesson, then the built-in ones. */
export function allLists(): StudyList[] {
  return mine.length || shared.length ? [...mine, ...shared, ...LISTS] : LISTS;
}

export const LIST_GROUPS = ['Old Testament', 'Whole Bible', 'New Testament'] as const;

/** Lists + item indexes whose reference is this verse. */
export function listsAtVerse(book: string, chapter: number, verse: number) {
  const key = `${book}.${chapter}.${verse}`;
  const out: { list: StudyList; index: number }[] = [];
  for (const l of allLists()) {
    const i = l.items.findIndex((it) => it.ref === key);
    if (i >= 0) out.push({ list: l, index: i });
  }
  return out;
}
