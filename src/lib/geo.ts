export interface Place {
  index: number;
  name: string;
  lat: number;
  lon: number;
  type: string;
  /** 0–100, OpenBible.info's confidence in the identification */
  confidence: number;
}

type VerseIndex = Record<string, Record<string, number[]>>; // chapter -> verse -> place indexes

const base = import.meta.env.BASE_URL;
let placesPromise: Promise<Place[]> | null = null;
const bookIndexes = new Map<string, Promise<VerseIndex>>();

export function loadPlaces(): Promise<Place[]> {
  placesPromise ??= fetch(`${base}data/places.json`)
    .then((r) => r.json())
    .then((rows: [string, number, number, string, number][]) =>
      rows.map(([name, lat, lon, type, confidence], index) => ({ index, name, lat, lon, type, confidence })),
    );
  return placesPromise;
}

export function loadBookIndex(osis: string): Promise<VerseIndex> {
  let p = bookIndexes.get(osis);
  if (!p) {
    p = fetch(`${base}data/verses/${osis}.json`)
      .then((r) => (r.ok ? r.json() : {}))
      .catch(() => ({}));
    bookIndexes.set(osis, p);
  }
  return p;
}

export interface ChapterGeo {
  /** verse number -> places mentioned in that verse */
  byVerse: Map<number, Place[]>;
  /** every distinct place in the chapter */
  all: Place[];
  /** the last place mentioned in the previous chapter(s) of the book, for context */
  carriedIn: { place: Place; chapter: number; verse: number } | null;
}

export async function loadChapterGeo(osis: string, chapter: number): Promise<ChapterGeo> {
  const [places, idx] = await Promise.all([loadPlaces(), loadBookIndex(osis)]);
  const byVerse = new Map<number, Place[]>();
  const seen = new Map<number, Place>();
  for (const [v, ids] of Object.entries(idx[String(chapter)] ?? {})) {
    const ps = ids.map((i) => places[i]);
    byVerse.set(Number(v), ps);
    ps.forEach((p) => seen.set(p.index, p));
  }
  let carriedIn: ChapterGeo['carriedIn'] = null;
  for (let ch = chapter - 1; ch >= 1 && !carriedIn; ch--) {
    const verses = idx[String(ch)];
    if (!verses) continue;
    const last = Math.max(...Object.keys(verses).map(Number));
    const ids = verses[String(last)];
    carriedIn = { place: places[ids[ids.length - 1]], chapter: ch, verse: last };
  }
  return { byVerse, all: [...seen.values()], carriedIn };
}

/**
 * Places for a verse. If the verse names no place, falls back to the most recent
 * place named earlier in the chapter (or a previous chapter) — "where they currently are".
 */
export function placesForVerse(
  geo: ChapterGeo,
  chapter: number,
  verse: number,
): { places: Place[]; inferred: boolean; from?: { chapter: number; verse: number } } {
  const direct = geo.byVerse.get(verse);
  if (direct?.length) return { places: direct, inferred: false };
  for (let v = verse - 1; v >= 1; v--) {
    const ps = geo.byVerse.get(v);
    if (ps?.length) return { places: [ps[ps.length - 1]], inferred: true, from: { chapter, verse: v } };
  }
  if (geo.carriedIn) {
    const { place, chapter: c, verse: v } = geo.carriedIn;
    return { places: [place], inferred: true, from: { chapter: c, verse: v } };
  }
  return { places: [], inferred: true };
}
