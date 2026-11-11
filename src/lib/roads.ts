/**
 * Route finding along Roman-era roads, from Itiner-e: The Digital Atlas of Ancient Roads (CC BY 4.0).
 * The network (public/data/roads.json) is built by scripts/build-roads.mjs and loads only when the
 * distance tool is used.
 */
import { milesBetween } from './distance';
import { legPath, type Journey } from './journeys';

export interface RoadsFile {
  nodes: number[]; // flat [lat*1000, lon*1000, …]
  edges: [number, number, number, number, number[]][]; // [from, to, miles*10, main road?, shape deltas]
}

export interface RoadGraph {
  lat: Float64Array;
  lon: Float64Array;
  edges: { a: number; b: number; miles: number; shape: [number, number][] }[];
  adj: number[][];
}

export interface RoadRoute {
  /** total, including the short walks from each place to the nearest road */
  miles: number;
  /** the path to draw, from A to B */
  path: [number, number][];
  /** the furthest either place is from a road (miles) */
  offRoad: number;
}

/** A place this far from any road is treated as having no road route. */
export const MAX_OFF_ROAD_MILES = 30;

export function buildGraph(f: RoadsFile): RoadGraph {
  const n = f.nodes.length / 2;
  const lat = new Float64Array(n);
  const lon = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    lat[i] = f.nodes[2 * i] / 1e3;
    lon[i] = f.nodes[2 * i + 1] / 1e3;
  }
  const adj: number[][] = Array.from({ length: n }, () => []);
  const edges = f.edges.map(([a, b, len, , d], i) => {
    const shape: [number, number][] = [];
    let y = f.nodes[2 * a];
    let x = f.nodes[2 * a + 1];
    for (let k = 0; k < d.length; k += 2) {
      y += d[k];
      x += d[k + 1];
      shape.push([y / 1e3, x / 1e3]);
    }
    adj[a].push(i);
    adj[b].push(i);
    return { a, b, miles: len / 10, shape };
  });
  return { lat, lon, edges, adj };
}

function nearestNode(g: RoadGraph, p: { lat: number; lon: number }): { node: number; miles: number } {
  let best = -1;
  let bestD = Infinity;
  const k = Math.cos((p.lat * Math.PI) / 180);
  for (let i = 0; i < g.lat.length; i++) {
    if (!g.adj[i].length) continue;
    const dy = g.lat[i] - p.lat;
    const dx = (g.lon[i] - p.lon) * k;
    const d = dy * dy + dx * dx;
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return { node: best, miles: best < 0 ? Infinity : milesBetween(p, { lat: g.lat[best], lon: g.lon[best] }) };
}

/** Small binary heap of [distance, node]. */
class Heap {
  private d: number[] = [];
  private n: number[] = [];
  get size() {
    return this.d.length;
  }
  push(dist: number, node: number) {
    const { d, n } = this;
    let i = d.length;
    d.push(dist);
    n.push(node);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (d[p] <= d[i]) break;
      [d[p], d[i]] = [d[i], d[p]];
      [n[p], n[i]] = [n[i], n[p]];
      i = p;
    }
  }
  pop(): [number, number] {
    const { d, n } = this;
    const top: [number, number] = [d[0], n[0]];
    const ld = d.pop()!;
    const ln = n.pop()!;
    if (d.length) {
      d[0] = ld;
      n[0] = ln;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < d.length && d[l] < d[m]) m = l;
        if (r < d.length && d[r] < d[m]) m = r;
        if (m === i) break;
        [d[m], d[i]] = [d[i], d[m]];
        [n[m], n[i]] = [n[i], n[m]];
        i = m;
      }
    }
    return top;
  }
}

/** Why there is no road route: a place is far from any road, or no road joins the two (e.g. across the sea). */
export type NoRoute = { none: 'far'; end: 'a' | 'b' } | { none: 'unconnected' };

/** Shortest way by road between two places. */
export function routeBetween(
  g: RoadGraph,
  from: { lat: number; lon: number },
  to: { lat: number; lon: number },
): RoadRoute | NoRoute {
  const s = nearestNode(g, from);
  const t = nearestNode(g, to);
  if (s.miles > MAX_OFF_ROAD_MILES) return { none: 'far', end: 'a' };
  if (t.miles > MAX_OFF_ROAD_MILES) return { none: 'far', end: 'b' };

  const dist = new Float64Array(g.lat.length).fill(Infinity);
  const via = new Int32Array(g.lat.length).fill(-1);
  const heap = new Heap();
  dist[s.node] = 0;
  heap.push(0, s.node);
  while (heap.size) {
    const [d, u] = heap.pop();
    if (u === t.node) break;
    if (d > dist[u]) continue;
    for (const ei of g.adj[u]) {
      const e = g.edges[ei];
      const v = e.a === u ? e.b : e.a;
      const nd = d + e.miles;
      if (nd < dist[v]) {
        dist[v] = nd;
        via[v] = ei;
        heap.push(nd, v);
      }
    }
  }
  if (!Number.isFinite(dist[t.node])) return { none: 'unconnected' };

  // walk back from the end, then lay the road shapes out from A to B
  const legs: number[] = [];
  for (let v = t.node; v !== s.node; ) {
    const ei = via[v];
    legs.push(ei);
    const e = g.edges[ei];
    v = e.a === v ? e.b : e.a;
  }
  legs.reverse();
  const path: [number, number][] = [[from.lat, from.lon], [g.lat[s.node], g.lon[s.node]]];
  let at = s.node;
  for (const ei of legs) {
    const e = g.edges[ei];
    const forward = e.a === at;
    const pts = forward ? e.shape : [...e.shape].reverse();
    const end = forward ? e.b : e.a;
    path.push(...pts, [g.lat[end], g.lon[end]]);
    at = end;
  }
  path.push([to.lat, to.lon]);

  return { miles: s.miles + dist[t.node] + t.miles, path, offRoad: Math.max(s.miles, t.miles) };
}

const base = import.meta.env?.BASE_URL ?? '/';
let graphPromise: Promise<RoadGraph> | null = null;

export function loadRoads(): Promise<RoadGraph> {
  graphPromise ??= fetch(`${base}data/roads.json`)
    .then((r) => {
      if (!r.ok) throw new Error(`roads ${r.status}`);
      return r.json() as Promise<RoadsFile>;
    })
    .then(buildGraph)
    .catch((e) => {
      graphPromise = null; // try again next time
      throw e;
    });
  return graphPromise;
}

/** Point halfway along a path (for the distance label). */
export function midpointAlong(path: [number, number][]): [number, number] {
  const seg = path.slice(1).map((p, i) => milesBetween({ lat: path[i][0], lon: path[i][1] }, { lat: p[0], lon: p[1] }));
  let half = seg.reduce((x, y) => x + y, 0) / 2;
  for (let i = 0; i < seg.length; i++) {
    if (half <= seg[i]) {
      const f = seg[i] ? half / seg[i] : 0;
      return [path[i][0] + (path[i + 1][0] - path[i][0]) * f, path[i][1] + (path[i + 1][1] - path[i][1]) * f];
    }
    half -= seg[i];
  }
  return path[path.length - 1];
}

/** Length of a path in miles. */
export function pathMiles(path: [number, number][]): number {
  let m = 0;
  for (let i = 1; i < path.length; i++)
    m += milesBetween({ lat: path[i - 1][0], lon: path[i - 1][1] }, { lat: path[i][0], lon: path[i][1] });
  return m;
}

/** How a journey leg is drawn and measured. */
export interface JourneyLeg {
  path: [number, number][];
  miles: number;
  /** road: along Roman roads; sea: by boat; traced: the journey's hand-traced route; direct: stop to stop */
  how: 'road' | 'sea' | 'traced' | 'direct';
}

/**
 * Each leg of a journey (index i = the leg arriving at stop i; index 0 is empty): along Roman roads where a road
 * joins the stops without a big detour; otherwise as drawn in the journey data (sea legs, hand-traced routes,
 * the wilderness).
 */
export function journeyLegs(g: RoadGraph, journey: Journey): (JourneyLeg | null)[] {
  return journey.stops.map((b, i) => {
    if (i === 0) return null;
    const a = journey.stops[i - 1];
    const drawn = legPath(journey, i);
    const direct: JourneyLeg = { path: drawn, miles: pathMiles(drawn), how: b.sea ? 'sea' : b.via ? 'traced' : 'direct' };
    if (b.sea || b.via || journey.roads === false || (a.lat === b.lat && a.lon === b.lon)) return direct;
    const r = routeBetween(g, a, b);
    // a road that wanders far out of the way probably isn't the way they went
    if ('none' in r || r.miles > direct.miles * 1.6 + 5) return direct;
    return { path: r.path, miles: r.miles, how: 'road' };
  });
}
