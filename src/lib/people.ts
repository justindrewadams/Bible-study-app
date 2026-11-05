/** Bible people from Theographic Bible Metadata (CC BY-SA 4.0); biographies from Easton's Bible Dictionary. */

export interface PersonEntry {
  index: number;
  slug: string;
  title: string; // e.g. "Mary (Mother of Jesus)"
  /** name as written in the text, e.g. "Mary" */
  name: string;
  gender: 'M' | 'F' | '';
  count: number;
  firstRef: string;
}

export interface PlaceRef {
  name: string;
  /** index into places.json when it matches one of our places */
  place?: number;
  lat?: number;
  lon?: number;
}

export interface PersonDetails {
  name: string;
  aka?: string[];
  groups?: string[];
  born?: number;
  died?: number;
  bornAt?: PlaceRef;
  diedAt?: PlaceRef;
  father?: string[];
  mother?: string[];
  spouses?: string[];
  siblings?: string[];
  children?: string[];
  bio?: string[];
  refs: string[];
}

const base = import.meta.env.BASE_URL;
let indexPromise: Promise<{ list: PersonEntry[]; bySlug: Map<string, PersonEntry> }> | null = null;
const shardCache = new Map<string, Promise<Record<string, PersonDetails>>>();
const bookCache = new Map<string, Promise<Record<string, Record<string, number[]>>>>();

export function loadPeople() {
  indexPromise ??= fetch(`${base}data/people.json`)
    .then((r) => r.json())
    .then((rows: [string, string, PersonEntry['gender'], number, string, string?][]) => {
      const list = rows.map(([slug, title, gender, count, firstRef, name], index) => ({
        index,
        slug,
        title,
        name: name ?? title.replace(/\s*\(.*\)\s*$/, ''),
        gender,
        count,
        firstRef,
      }));
      return { list, bySlug: new Map(list.map((p) => [p.slug, p])) };
    });
  return indexPromise;
}

export function loadPerson(slug: string): Promise<PersonDetails | undefined> {
  const letter = /^[a-z]/i.test(slug) ? slug[0].toLowerCase() : '_';
  let p = shardCache.get(letter);
  if (!p) {
    p = fetch(`${base}data/people/${letter}.json`).then((r) => (r.ok ? r.json() : {}));
    shardCache.set(letter, p);
  }
  return p.then((s) => s[slug]);
}

let placePeoplePromise: Promise<Record<string, { born?: string[]; died?: string[] }>> | null = null;
export function loadPlacePeople() {
  placePeoplePromise ??= fetch(`${base}data/place-people.json`).then((r) => (r.ok ? r.json() : {}));
  return placePeoplePromise;
}

/** People in each verse of a chapter. */
export async function loadChapterPeople(book: string, chapter: number): Promise<Map<number, PersonEntry[]>> {
  let p = bookCache.get(book);
  if (!p) {
    p = fetch(`${base}data/people-verses/${book}.json`)
      .then((r) => (r.ok ? r.json() : {}))
      .catch(() => ({}));
    bookCache.set(book, p);
  }
  const [{ list }, idx] = await Promise.all([loadPeople(), p]);
  const out = new Map<number, PersonEntry[]>();
  for (const [v, ids] of Object.entries(idx[String(chapter)] ?? {})) out.set(Number(v), ids.map((i) => list[i]));
  return out;
}

/** Names that should not be highlighted inline (too common, or usually mean the nation). */
export const NO_INLINE = new Set(['jesus_905']);
export const NO_INLINE_NAMES = new Set(['Israel', 'Judah']);

export function formatYear(y: number): string {
  return y < 0 ? `${-y} BC` : `AD ${y}`;
}

/** Splits an Easton's entry into text and verse links. */
export function bioParts(text: string): ({ text: string } | { text: string; ref: string })[] {
  const out: ({ text: string } | { text: string; ref: string })[] = [];
  const re = /\[([^\]]+)\]\(([^)]*)\)/g;
  let last = 0;
  for (const m of text.matchAll(re)) {
    if (m.index! > last) out.push({ text: text.slice(last, m.index) });
    const ref = /#([1-3]?[A-Za-z]+\.\d+\.\d+)/.exec(m[2])?.[1];
    out.push(ref ? { text: m[1], ref } : { text: m[1] });
    last = m.index! + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last) });
  return out;
}
