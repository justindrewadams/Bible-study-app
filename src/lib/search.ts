/**
 * Site-wide search over the app's own data: people, places, journeys, study lists, periods, nations,
 * hymns (titles and writers only) and Bible references. It never searches the Bible text itself.
 */
import { BOOKS, getBook, type Book } from '../data/books';
import { NATIONS, type Nation } from '../data/nations';
import { PERIODS, type Period } from '../data/periods';
import type { Hymn } from '../data/hymns';
import { loadPlaces, type Place } from './geo';
import { JOURNEYS, type Journey } from './journeys';
import { LISTS, type StudyList } from './lists';
import { loadPeople, loadPlacePeople, type PersonEntry } from './people';
import { loadPlaceDetails } from './placeInfo';

/** Lower-case, no accents, straight quotes. Keeps the length the same, so matches map back onto the original. */
export function norm(s: string): string {
  let out = '';
  for (const ch of s) {
    const c = ch.normalize('NFD')[0].toLowerCase();
    out += c.length === ch.length ? c.replace(/[‘’]/, "'").replace(/[“”]/, '"') : ch;
  }
  return out;
}

const tokens = (q: string) => norm(q).split(/[^a-z0-9']+/).filter(Boolean);
const isWordChar = (c: string | undefined) => !!c && /[a-z0-9]/.test(c);

/** Position of a token where it starts a word, or -1. */
function wordStart(text: string, token: string, from = 0): number {
  for (let i = text.indexOf(token, from); i >= 0; i = text.indexOf(token, i + 1)) {
    if (!isWordChar(text[i - 1])) return i;
  }
  return -1;
}

/** Every word of the query starts a word somewhere in the text. */
function hasAll(ntext: string, toks: string[]) {
  return toks.length > 0 && toks.every((t) => wordStart(ntext, t) >= 0);
}

/** 100 exact, 70 starts with, 50 every word matches the start of a word, else 0. */
function nameScore(nname: string, nq: string, toks: string[]) {
  if (nname === nq) return 100;
  if (nname.startsWith(nq)) return 70;
  return hasAll(nname, toks) ? 50 : 0;
}

/** A short excerpt around the first match, split so the matched word can be shown in bold. */
export interface Snippet {
  before: string;
  match: string;
  after: string;
}

export function snippet(text: string, query: string, width = 90): Snippet {
  const ntext = norm(text);
  const toks = tokens(query);
  let at = -1;
  let len = 0;
  for (const t of toks) {
    const i = wordStart(ntext, t);
    if (i >= 0 && (at < 0 || i < at)) {
      at = i;
      len = t.length;
    }
  }
  if (at < 0) return { before: text.length > width ? text.slice(0, width).trimEnd() + '…' : text, match: '', after: '' };
  // extend the bold to the end of the word ("Paul" → "Paul's")
  let end = at + len;
  while (isWordChar(ntext[end])) end++;
  const room = Math.max(0, width - (end - at));
  let start = Math.max(0, at - Math.floor(room / 3));
  if (start > 0) {
    const sp = text.indexOf(' ', start);
    start = sp >= 0 && sp < at ? sp + 1 : start;
  }
  let stop = Math.min(text.length, end + room - (at - start));
  if (stop < text.length) {
    const sp = text.lastIndexOf(' ', stop);
    stop = sp > end ? sp : stop;
  }
  return {
    before: (start > 0 ? '…' : '') + text.slice(start, at),
    match: text.slice(at, end),
    after: text.slice(end, stop) + (stop < text.length ? '…' : ''),
  };
}

// ---------------------------------------------------------------- results

export interface RefResult {
  book: Book;
  chapter: number;
  verse: number | null;
  label: string;
}
export interface PersonResult {
  person: PersonEntry;
  /** e.g. "also called Saul" */
  note?: string;
}
export interface PlaceResult {
  place: Place;
  /** most likely modern site, to tell apart places with the same name */
  modern?: string;
  note?: string;
  text?: string;
}
export interface JourneyResult {
  journey: Journey;
  stopIndex: number;
  text?: string;
}
export interface ListResult {
  list: StudyList;
  index: number;
  /** set when the match is one item, not the whole list */
  item?: string;
  text?: string;
}
export interface PeriodResult {
  period: Period;
  text?: string;
}
export interface NationResult {
  nation: Nation;
  text?: string;
}
export interface HymnResult {
  hymn: Hymn;
}

export interface SearchResults {
  query: string;
  refs: RefResult[];
  people: PersonResult[];
  places: PlaceResult[];
  journeys: JourneyResult[];
  lists: ListResult[];
  periods: PeriodResult[];
  nations: NationResult[];
  hymns: HymnResult[];
}

// ---------------------------------------------------------------- the index (built once)

interface Index {
  people: { p: PersonEntry; name: string; title: string; aka: string[]; rawAka: string[] }[];
  places: { p: Place; names: string[]; rawNames: string[]; modern?: string; stories: { t: string; ref: string }[] }[];
  /** person slug -> places they were born or died at */
  personPlaces: Map<string, { index: number; kind: 'born' | 'died' }[]>;
  hymns: Hymn[];
}

const base = import.meta.env.BASE_URL;
let indexPromise: Promise<Index> | null = null;

/** Loads everything search needs (people, places, hymns). Safe to call early, e.g. when the box gets focus. */
export function loadSearchIndex(): Promise<Index> {
  indexPromise ??= Promise.all([
    loadPeople(),
    loadPlaces(),
    loadPlaceDetails(),
    loadPlacePeople(),
    fetch(`${base}data/people-aka.json`)
      .then((r): Promise<Record<string, string[]>> | Record<string, string[]> => (r.ok ? r.json() : {}))
      .catch(() => ({}) as Record<string, string[]>),
    import('../data/hymns').then((m) => m.HYMNS),
  ]).then(([{ list }, places, details, placePeople, akaBySlug, hymns]) => {
    const personPlaces = new Map<string, { index: number; kind: 'born' | 'died' }[]>();
    for (const [i, v] of Object.entries(placePeople)) {
      for (const kind of ['born', 'died'] as const)
        for (const slug of v[kind] ?? []) {
          let arr = personPlaces.get(slug);
          if (!arr) personPlaces.set(slug, (arr = []));
          arr.push({ index: Number(i), kind });
        }
    }
    return {
      people: list.map((p) => {
        const rawAka = akaBySlug[p.slug] ?? [];
        return { p, name: norm(p.name), title: norm(p.title), aka: rawAka.map(norm), rawAka };
      }),
      places: places.map((p) => {
        const d = details[p.index];
        const rawNames = [p.name, ...(d?.alt ?? []), ...(d?.aka ?? [])];
        return { p, names: rawNames.map(norm), rawNames, modern: d?.modern?.[0]?.[0], stories: d?.stories ?? [] };
      }),
      personPlaces,
      hymns,
    };
  });
  return indexPromise;
}

// ---------------------------------------------------------------- Bible references

const BOOK_KEYS = BOOKS.map((b) => ({
  b,
  keys: [norm(b.name).replace(/\s+/g, ''), norm(b.osis), ...(b.osis === 'Ps' ? ['psalm'] : [])],
}));

/** "John 3:16", "1 cor 13", "Psalm 23", "Acts" → places to read. */
export function parseReference(q: string): RefResult[] {
  const m = /^\s*([1-3]?\s*[a-z][a-z .]*?)\.?\s*(?:(\d+)(?:\s*[:.]\s*(\d+))?)?\s*$/i.exec(norm(q));
  if (!m) return [];
  const name = m[1].replace(/[\s.]+/g, '');
  const chapter = m[2] ? Number(m[2]) : null;
  const verse = m[3] ? Number(m[3]) : null;
  // a bare word only counts as a book when it is long enough to be meant ("Acts", "Job", not "a")
  if (name.length < 2 || (chapter == null && name.length < 3)) return [];
  const exact = BOOK_KEYS.filter((k) => k.keys.includes(name));
  const books = exact.length ? exact : chapter != null || name.length >= 4 ? BOOK_KEYS.filter((k) => k.keys.some((key) => key.startsWith(name))) : [];
  return books.slice(0, 3).flatMap(({ b }) => {
    const ch = chapter ?? 1;
    if (ch < 1 || ch > b.chapters) return [];
    const name = b.osis === 'Ps' && chapter != null ? 'Psalm' : b.name;
    const label = chapter == null ? b.name : verse != null ? `${name} ${ch}:${verse}` : `${name} ${ch}`;
    return [{ book: b, chapter: ch, verse, label }];
  });
}

// ---------------------------------------------------------------- search

export function search(index: Index, query: string): SearchResults {
  const nq = norm(query).trim().replace(/\s+/g, ' ');
  const toks = tokens(query);
  const empty: SearchResults = { query, refs: [], people: [], places: [], journeys: [], lists: [], periods: [], nations: [], hymns: [] };
  if (nq.length < 2 || !toks.length) return empty;
  const textHit = (s: string | undefined) => !!s && hasAll(norm(s), toks);

  // people: best name match first, then the most often mentioned
  const people: (PersonResult & { score: number })[] = [];
  for (const e of index.people) {
    let score = Math.max(nameScore(e.name, nq, toks), nameScore(e.title, nq, toks) - 5);
    let note: string | undefined;
    e.aka.forEach((a, i) => {
      const s = nameScore(a, nq, toks) - 10;
      if (s > score) {
        score = s;
        note = `also called ${e.rawAka[i]}`;
      }
    });
    if (score > 0) people.push({ person: e.p, note, score });
  }
  people.sort((a, b) => b.score - a.score || b.person.count - a.person.count);

  // the people the search is really about (an exact name), used to link their places and nations
  const lead = people.filter((r) => r.score >= 90).slice(0, 3).map((r) => r.person);
  const leadSlugs = new Set(lead.map((p) => p.slug));

  // journeys
  const journeys: JourneyResult[] = [];
  const journeyTitleHits = new Set<string>();
  for (const j of JOURNEYS) {
    if (textHit(j.title) || textHit(j.summary)) {
      journeys.push({ journey: j, stopIndex: 0, text: j.summary });
      if (textHit(j.title)) journeyTitleHits.add(j.id);
      continue;
    }
    const i = j.stops.findIndex((s) => textHit(s.note) || textHit(s.place));
    if (i >= 0) journeys.push({ journey: j, stopIndex: i, text: `${j.stops[i].place}: ${j.stops[i].note}` });
  }

  // places: by name, then a lead person's birth and death places, key stories, and journey stops
  const placeMap = new Map<number, PlaceResult & { score: number }>();
  const addPlace = (i: number | null | undefined, score: number, note?: string, text?: string) => {
    if (i == null || i < 0) return;
    const e = index.places[i];
    if (!e) return;
    const had = placeMap.get(i);
    if (!had || had.score < score) placeMap.set(i, { place: e.p, modern: e.modern, score, note: note ?? had?.note, text: text ?? had?.text });
  };
  for (const e of index.places) {
    let best = 0;
    let via: string | undefined;
    e.names.forEach((n, k) => {
      const s = nameScore(n, nq, toks) - (k ? 5 : 0);
      if (s > best) {
        best = s;
        via = k ? `also called ${e.rawNames[k]}` : undefined;
      }
    });
    if (best > 0) addPlace(e.p.index, 1000 + best, via);
  }
  for (const p of lead) {
    for (const at of index.personPlaces.get(p.slug) ?? [])
      addPlace(at.index, 800, `${at.kind === 'born' ? 'Birthplace' : 'Place of death'} of ${p.title}`);
  }
  for (const e of index.places) {
    const story = e.stories.find((s) => textHit(s.t));
    if (story) addPlace(e.p.index, 600, undefined, story.t);
  }
  for (const r of journeys) {
    const j = r.journey;
    if (journeyTitleHits.has(j.id)) j.stops.forEach((s) => addPlace(s.placeIndex, 400, `Stop on ${j.title}`));
    else j.stops.forEach((s) => textHit(s.note) && addPlace(s.placeIndex, 500, j.title, s.note));
  }
  const places = [...placeMap.values()].sort((a, b) => b.score - a.score);

  // study lists: a whole list, or the items in it
  const lists: ListResult[] = [];
  for (const l of LISTS) {
    if (textHit(l.title) || textHit(l.summary)) lists.push({ list: l, index: 0, text: l.summary });
    l.items.forEach((it, i) => {
      if (textHit(it.t) || textHit(it.note) || textHit(it.place))
        lists.push({ list: l, index: i, item: it.t, text: it.note });
    });
  }

  // periods
  const journeyIds = new Set(journeys.map((r) => r.journey.id));
  const periods: PeriodResult[] = [];
  for (const p of PERIODS) {
    const linked = JOURNEYS.find((j) => p.journeys.includes(j.id) && journeyIds.has(j.id));
    let text: string | undefined;
    if (textHit(p.name)) text = p.summary;
    else
      text =
        [p.summary, ...p.people, p.note].find(textHit) ??
        p.events.find((e) => textHit(e.t))?.t ??
        (linked ? `Includes ${linked.title}` : undefined);
    if (text) periods.push({ period: p, text });
  }

  // nations
  const nations: NationResult[] = [];
  for (const n of NATIONS) {
    const rel = n.related?.find((r) => leadSlugs.has(r.slug));
    const inLine = n.line?.some((s) => leadSlugs.has(s));
    let text: string | undefined;
    if ([n.name, ...(n.aka ?? [])].some(textHit)) text = n.region;
    else if (inLine) text = n.origin;
    else if (rel) text = rel.note;
    else text = [n.region, n.origin, ...n.history].find(textHit) ?? n.refs.find((r) => textHit(r.t))?.t;
    if (text) nations.push({ nation: n, text });
  }

  // hymns: titles and writers only
  const hymns = index.hymns.filter((h) => textHit(h.title) || textHit(h.by)).map((hymn) => ({ hymn }));

  return {
    query,
    refs: parseReference(query),
    people: people.map(({ person, note }) => ({ person, note })),
    places: places.map(({ place, modern, note, text }) => ({ place, modern, note, text })),
    // named in the title or summary first, then those that only mention it along the way
    journeys: [...journeys].sort((a, b) => Number(a.stopIndex > 0) - Number(b.stopIndex > 0)),
    // whole lists first, then single items
    lists: [...lists].sort((a, b) => Number(a.item != null) - Number(b.item != null)),
    periods,
    nations,
    hymns,
  };
}

/** "Ps.23.1-6" → "Psalm 23:1–6" */
export function formatShortRef(ref: string): string {
  const [b, c, v] = ref.split('.');
  const name = b === 'Ps' ? 'Psalm' : getBook(b).name;
  return `${name} ${c}${v ? `:${v.replace('-', '–')}` : ''}`;
}
