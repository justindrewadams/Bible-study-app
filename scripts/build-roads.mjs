/**
 * Builds public/data/roads.json, a compact road network for the distance tool, from
 * Itiner-e: The Digital Atlas of Ancient Roads, static version 2024 (CC BY 4.0).
 *   de Soto, Pažout, Brughmans et al., Scientific Data (2025), https://doi.org/10.1038/s41597-025-06140-z
 *   Data: https://zenodo.org/records/17122148
 * Changes made here: clipped to the Bible lands and the Mediterranean, geometry simplified and rounded,
 * and road ends joined into a network for route finding.
 *
 * Run: npm run build:roads (downloads ~78 MB into scripts/.cache/roads on first run)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const cacheDir = path.join(root, 'scripts', '.cache', 'roads');
const src = path.join(cacheDir, 'itinere_roads.geojson');
const URL = 'https://zenodo.org/api/records/17122148/files/itinere_roads.geojson/content';

if (!fs.existsSync(src)) {
  fs.mkdirSync(cacheDir, { recursive: true });
  console.log('Downloading Itiner-e roads…');
  const res = await fetch(URL);
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);
  fs.writeFileSync(src, Buffer.from(await res.arrayBuffer()));
}

// --- World Mercator (EPSG:3395, WGS84 ellipsoid) -> latitude/longitude
const A = 6378137;
const E = 0.0818191908426215;
function toLatLon(x, y) {
  const lon = (x / A) * (180 / Math.PI);
  const t = Math.exp(-y / A);
  let phi = Math.PI / 2 - 2 * Math.atan(t);
  for (let i = 0; i < 8; i++) {
    const es = E * Math.sin(phi);
    phi = Math.PI / 2 - 2 * Math.atan(t * Math.pow((1 - es) / (1 + es), E / 2));
  }
  return [(phi * 180) / Math.PI, lon];
}

const miles = (a, b) => {
  const r = (d) => (d * Math.PI) / 180;
  const h = Math.sin(r(b[0] - a[0]) / 2) ** 2 + Math.cos(r(a[0])) * Math.cos(r(b[0])) * Math.sin(r(b[1] - a[1]) / 2) ** 2;
  return 2 * 3958.8 * Math.asin(Math.min(1, Math.sqrt(h)));
};

/** Douglas–Peucker in degrees (fine at these scales). */
function simplify(pts, tol) {
  if (pts.length < 3) return pts;
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [i, j] = stack.pop();
    const [ay, ax] = pts[i];
    const [by, bx] = pts[j];
    const dx = bx - ax;
    const dy = by - ay;
    const len = Math.hypot(dx, dy) || 1e-12;
    let best = -1;
    let at = -1;
    for (let k = i + 1; k < j; k++) {
      const d = Math.abs(dy * (pts[k][1] - ax) - dx * (pts[k][0] - ay)) / len;
      if (d > best) {
        best = d;
        at = k;
      }
    }
    if (best > tol) {
      keep[at] = 1;
      stack.push([i, at], [at, j]);
    }
  }
  return pts.filter((_, k) => keep[k]);
}

// Bible lands and the Mediterranean: Italy and Libya to Mesopotamia and Persia
const BOX = { latMin: 22, latMax: 47, lonMin: 5, lonMax: 52 };
const inBox = ([lat, lon]) => lat >= BOX.latMin && lat <= BOX.latMax && lon >= BOX.lonMin && lon <= BOX.lonMax;

const data = JSON.parse(fs.readFileSync(src, 'utf8'));
const lines = [];
for (const f of data.features) {
  const g = f.geometry;
  if (!g) continue;
  const parts = g.type === 'LineString' ? [g.coordinates] : g.type === 'MultiLineString' ? g.coordinates : [];
  for (const part of parts) {
    const pts = part.map(([x, y]) => toLatLon(x, y));
    if (pts.length < 2 || !pts.some(inBox)) continue;
    lines.push({ pts, main: f.properties.Route_Type === 2 });
  }
}

// --- join road ends that touch (within ~400 m) into shared junctions
const SNAP = 0.004; // degrees
const grid = new Map();
const nodes = [];
function nodeAt(p) {
  const gx = Math.round(p[1] / SNAP);
  const gy = Math.round(p[0] / SNAP);
  let best = -1;
  let bestD = Infinity;
  for (let dx = -1; dx <= 1; dx++)
    for (let dy = -1; dy <= 1; dy++)
      for (const id of grid.get(`${gx + dx},${gy + dy}`) ?? []) {
        const d = Math.hypot(nodes[id][0] - p[0], nodes[id][1] - p[1]);
        if (d < SNAP && d < bestD) {
          bestD = d;
          best = id;
        }
      }
  if (best >= 0) return best;
  nodes.push(p);
  const key = `${gx},${gy}`;
  if (!grid.has(key)) grid.set(key, []);
  grid.get(key).push(nodes.length - 1);
  return nodes.length - 1;
}

const edges = [];
for (const { pts, main } of lines) {
  const a = nodeAt(pts[0]);
  const b = nodeAt(pts[pts.length - 1]);
  if (a === b && pts.length < 3) continue;
  let len = 0;
  for (let i = 1; i < pts.length; i++) len += miles(pts[i - 1], pts[i]);
  const shape = simplify(pts, 0.003).slice(1, -1);
  edges.push({ a, b, len, main, shape });
}

// keep the connected pieces that are big enough to matter (drops stray fragments)
const adj = nodes.map(() => []);
edges.forEach((e, i) => {
  adj[e.a].push(i);
  adj[e.b].push(i);
});
const comp = new Int32Array(nodes.length).fill(-1);
const sizes = [];
for (let s = 0; s < nodes.length; s++) {
  if (comp[s] >= 0) continue;
  const c = sizes.length;
  let n = 0;
  const stack = [s];
  comp[s] = c;
  while (stack.length) {
    const u = stack.pop();
    n++;
    for (const ei of adj[u]) {
      const v = edges[ei].a === u ? edges[ei].b : edges[ei].a;
      if (comp[v] < 0) {
        comp[v] = c;
        stack.push(v);
      }
    }
  }
  sizes.push(n);
}
const keepEdge = edges.filter((e) => sizes[comp[e.a]] >= 4);
const used = new Map();
const outNodes = [];
const idOf = (n) => {
  if (!used.has(n)) {
    used.set(n, outNodes.length / 2);
    outNodes.push(Math.round(nodes[n][0] * 1e3), Math.round(nodes[n][1] * 1e3));
  }
  return used.get(n);
};
const outEdges = keepEdge.map((e) => {
  const a = idOf(e.a);
  const b = idOf(e.b);
  // shape as deltas in thousandths of a degree from the start node
  let [py, px] = [Math.round(nodes[e.a][0] * 1e3), Math.round(nodes[e.a][1] * 1e3)];
  const flat = [];
  for (const [lat, lon] of e.shape) {
    const y = Math.round(lat * 1e3);
    const x = Math.round(lon * 1e3);
    if (y === py && x === px) continue;
    flat.push(y - py, x - px);
    py = y;
    px = x;
  }
  return [a, b, Math.round(e.len * 10), e.main ? 1 : 0, flat];
});

const out = {
  source:
    'Itiner-e: The Digital Atlas of Ancient Roads, static version 2024 (de Soto, Pažout, Brughmans et al. 2025), CC BY 4.0, https://zenodo.org/records/17122148. Clipped, simplified and joined into a network for this app.',
  nodes: outNodes,
  edges: outEdges,
};
const file = path.join(root, 'public', 'data', 'roads.json');
fs.writeFileSync(file, JSON.stringify(out));
const biggest = Math.max(...sizes);
console.log(
  `roads.json: ${outNodes.length / 2} junctions, ${outEdges.length} road segments, largest network ${biggest} junctions, ${(fs.statSync(file).size / 1024).toFixed(0)} KB`,
);
