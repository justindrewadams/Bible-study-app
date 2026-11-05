import raw from '../data/journeys.json';

export interface Stop {
  place: string;
  ref: string; // OSIS, e.g. "Acts.13.4"
  note: string;
  lat: number;
  lon: number;
  placeIndex: number | null;
}

export interface Journey {
  id: string;
  title: string;
  era: string;
  color: string;
  summary: string;
  stops: Stop[];
}

export const JOURNEYS = raw as Journey[];

export function parseRef(ref: string): { book: string; chapter: number; verse: number } {
  const [book, ch, v] = ref.split('.');
  return { book, chapter: Number(ch), verse: Number(v) };
}

/** Journeys + stop indexes that touch a given verse. */
export function journeysAtVerse(book: string, chapter: number, verse: number) {
  const key = `${book}.${chapter}.${verse}`;
  const out: { journey: Journey; stopIndex: number }[] = [];
  for (const j of JOURNEYS) {
    const i = j.stops.findIndex((s) => s.ref === key);
    if (i >= 0) out.push({ journey: j, stopIndex: i });
  }
  return out;
}

/** Compass-style screen angle (degrees, 0 = east, counter-clockwise positive) between two points in Web Mercator. */
export function mercatorAngle(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const y = (lat: number) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
  const dx = ((b.lon - a.lon) * Math.PI) / 180;
  const dy = y(b.lat) - y(a.lat);
  return (Math.atan2(dy, dx) * 180) / Math.PI;
}
