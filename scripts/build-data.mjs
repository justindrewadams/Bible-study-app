// Builds the app's geography data from OpenBible.info's Bible Geocoding Data
// (CC BY 4.0, https://github.com/openbibleinfo/Bible-Geocoding-Data).
//
// Outputs:
//   public/data/places.json        – every geocoded place: [name, lat, lon, type, confidence]
//   public/data/verses/<Book>.json – { "chapter": { "verse": [placeIndex, ...] } }
//   src/data/journeys.json         – curated journeys with resolved coordinates
//
// Run: npm run build:data
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cacheDir = path.join(root, 'scripts', '.cache');
const srcFile = path.join(cacheDir, 'ancient.jsonl');
const SRC_URL =
  'https://raw.githubusercontent.com/openbibleinfo/Bible-Geocoding-Data/main/data/ancient.jsonl';

async function ensureSource() {
  if (fs.existsSync(srcFile)) return;
  fs.mkdirSync(cacheDir, { recursive: true });
  console.log(`Downloading ${SRC_URL} ...`);
  const res = await fetch(SRC_URL);
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);
  fs.writeFileSync(srcFile, Buffer.from(await res.arrayBuffer()));
}

function parseLonLat(s) {
  if (!s) return null;
  const [lon, lat] = s.split(',').map(Number);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return { lat: +lat.toFixed(4), lon: +lon.toFixed(4) };
}

/** Confidence 0–100 from OpenBible's score (vote_average is 0–1000-ish). */
function confidence(ident) {
  const v = ident?.score?.vote_average ?? 0;
  return Math.max(0, Math.min(100, Math.round(v / 5)));
}

await ensureSource();
const rows = fs
  .readFileSync(srcFile, 'utf8')
  .split('\n')
  .filter(Boolean)
  .map((l) => JSON.parse(l));

const places = []; // [name, lat, lon, type, confidence]
const placeIndexById = new Map();
const rowsByName = new Map(); // base name -> rows
const byBook = {}; // book -> ch -> v -> Set(idx)

for (const r of rows) {
  const ident = r.identifications?.[0];
  const ll = parseLonLat(ident?.resolutions?.[0]?.lonlat);
  if (!ll) continue;
  // "Bethel 1" -> display "Bethel"
  const display = r.friendly_id.replace(/ \d+$/, '');
  const idx = places.length;
  places.push([display, ll.lat, ll.lon, r.types?.[0] ?? 'place', confidence(ident)]);
  placeIndexById.set(r.id, idx);
  const verses = (r.verses ?? []).map((v) => v.osis);
  const entry = { row: r, idx, ll, verses: new Set(verses) };
  if (!rowsByName.has(display)) rowsByName.set(display, []);
  rowsByName.get(display).push(entry);

  for (const osis of verses) {
    const [book, ch, v] = osis.split('.');
    ((byBook[book] ??= {})[ch] ??= {})[v] ??= new Set();
    byBook[book][ch][v].add(idx);
  }
}

// --- write places + per-book verse indexes
const outData = path.join(root, 'public', 'data');
const outVerses = path.join(outData, 'verses');
fs.rmSync(outVerses, { recursive: true, force: true });
fs.mkdirSync(outVerses, { recursive: true });
fs.writeFileSync(path.join(outData, 'places.json'), JSON.stringify(places));
let mentions = 0;
for (const [book, chapters] of Object.entries(byBook)) {
  const out = {};
  for (const [ch, verses] of Object.entries(chapters)) {
    out[ch] = {};
    for (const [v, set] of Object.entries(verses)) {
      out[ch][v] = [...set];
      mentions += set.size;
    }
  }
  fs.writeFileSync(path.join(outVerses, `${book}.json`), JSON.stringify(out));
}
console.log(`places: ${places.length}, verse mentions: ${mentions}, books: ${Object.keys(byBook).length}`);

// --- resolve journeys
const journeys = JSON.parse(fs.readFileSync(path.join(root, 'scripts', 'journeys.source.json'), 'utf8'));
const errors = [];
for (const j of journeys) {
  for (const stop of j.stops) {
    if (stop.lat != null && stop.lon != null) {
      stop.placeIndex = null;
      continue;
    }
    const cands = rowsByName.get(stop.place) ?? [];
    const chapter = stop.ref.split('.').slice(0, 2).join('.') + '.';
    const pick =
      cands.find((c) => c.verses.has(stop.ref)) ??
      cands.find((c) => [...c.verses].some((v) => v.startsWith(chapter))) ??
      (cands.length === 1 ? cands[0] : null);
    if (!pick) {
      errors.push(`${j.id}: could not resolve "${stop.place}" for ${stop.ref} (${cands.length} candidates)`);
      continue;
    }
    stop.lat = pick.ll.lat;
    stop.lon = pick.ll.lon;
    stop.placeIndex = pick.idx;
  }
}
if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
fs.writeFileSync(path.join(root, 'src', 'data', 'journeys.json'), JSON.stringify(journeys, null, 1));
console.log(`journeys: ${journeys.length}, stops: ${journeys.reduce((n, j) => n + j.stops.length, 0)}`);
