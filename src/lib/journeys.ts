import raw from '../data/journeys.json';

export interface Stop {
  place: string;
  ref: string; // OSIS, e.g. "Acts.13.4"
  note: string;
  lat: number;
  lon: number;
  placeIndex: number | null;
  /** waypoints [lat, lon] for the leg arriving at this stop, so it follows a real route */
  via?: [number, number][];
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

type LatLon = [number, number];

/** Points from stop i-1 to stop i, including any route waypoints. */
export function legPath(journey: Journey, i: number): LatLon[] {
  const a = journey.stops[i - 1];
  const b = journey.stops[i];
  return [[a.lat, a.lon], ...(b.via ?? []), [b.lat, b.lon]];
}

/** Point and direction at fraction t (0–1) of the way along a path. */
export function pointAlong(path: LatLon[], t: number): { point: LatLon; angle: number } {
  const seg = path.slice(1).map((p, k) => Math.hypot(p[0] - path[k][0], p[1] - path[k][1]));
  const total = seg.reduce((x, y) => x + y, 0);
  let target = total * Math.max(0, Math.min(1, t));
  for (let k = 0; k < seg.length; k++) {
    if (target <= seg[k] || k === seg.length - 1) {
      const f = seg[k] ? Math.min(1, target / seg[k]) : 0;
      const [a, b] = [path[k], path[k + 1]];
      return {
        point: [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f],
        angle: mercatorAngle({ lat: a[0], lon: a[1] }, { lat: b[0], lon: b[1] }),
      };
    }
    target -= seg[k];
  }
  return { point: path[path.length - 1], angle: 0 };
}
