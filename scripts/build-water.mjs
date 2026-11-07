// Lakes and rivers of the Bible lands, drawn as crisp vector shapes on the map so the
// Sea of Galilee, the Jordan, the Dead Sea etc. stay clear when zoomed in.
// Source: Natural Earth 1:10m lakes and rivers (public domain, naturalearthdata.com).
//
// Output: public/data/water.json  { lakes: [[name, rings]], rivers: [[name, lines]] }  (coords as [lat, lon])
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cache = path.join(root, 'scripts', '.cache', 'natural-earth');
const BASE = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/';

async function load(name) {
  const file = path.join(cache, `${name}.geojson`);
  if (!fs.existsSync(file)) {
    fs.mkdirSync(cache, { recursive: true });
    console.log(`Downloading ${name} ...`);
    const res = await fetch(BASE + `${name}.geojson`);
    if (!res.ok) throw new Error(`Download failed: ${res.status}`);
    fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  }
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

// Mediterranean world: Italy to Persia, Egypt to the Black Sea
const BOX = { minLon: 10, maxLon: 50, minLat: 20, maxLat: 42 };
const inBox = ([lon, lat]) => lon >= BOX.minLon && lon <= BOX.maxLon && lat >= BOX.minLat && lat <= BOX.maxLat;
const r4 = (n) => Math.round(n * 1e4) / 1e4;
const toLatLon = (ring) => ring.map(([lon, lat]) => [r4(lat), r4(lon)]);

// Biblical names for the waters people will look for
const RENAME = {
  'Dead Sea': 'Salt Sea (Dead Sea)',
  Jordan: 'Jordan River',
  Firat: 'Euphrates',
  'Al Furat': 'Euphrates',
  Dicle: 'Tigris',
  Tevere: 'Tiber',
};

const [lakes, rivers] = await Promise.all([load('ne_10m_lakes'), load('ne_10m_rivers_lake_centerlines')]);

const outLakes = [];
for (const f of lakes.features) {
  const g = f.geometry;
  if (!g) continue;
  const polys = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
  for (const poly of polys) {
    if (!poly[0].some(inBox)) continue;
    const name = f.properties.name ?? '';
    outLakes.push([RENAME[name] ?? name, poly.map(toLatLon)]);
  }
}

const outRivers = [];
for (const f of rivers.features) {
  const g = f.geometry;
  if (!g || f.properties.featurecla === 'Lake Centerline') continue;
  const lines = g.type === 'LineString' ? [g.coordinates] : g.type === 'MultiLineString' ? g.coordinates : [];
  const kept = lines.filter((l) => l.some(inBox)).map(toLatLon);
  if (!kept.length) continue;
  const name = f.properties.name ?? '';
  outRivers.push([RENAME[name] ?? name, kept]);
}

const out = path.join(root, 'public', 'data', 'water.json');
fs.writeFileSync(out, JSON.stringify({ lakes: outLakes, rivers: outRivers }));
console.log(`water: ${outLakes.length} lakes, ${outRivers.length} rivers, ${(fs.statSync(out).size / 1024).toFixed(0)} KB`);
