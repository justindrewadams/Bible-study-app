// Builds the app's geography data from OpenBible.info's Bible Geocoding Data
// (CC BY 4.0, https://github.com/openbibleinfo/Bible-Geocoding-Data).
//
// Outputs:
//   public/data/places.json        – every geocoded place: [name, lat, lon, type, confidence]
//   public/data/verses/<Book>.json – { "chapter": { "verse": [placeIndex, ...] } }
//   public/data/place-details.json – per-place info card data (aligned with places.json)
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

/**
 * Confidence 0–100. OpenBible scores each modern site association 0–1000;
 * fall back to the identification's vote average when there's no modern site.
 */
function confidence(row, ident) {
  const scores = Object.values(row.modern_associations ?? {}).map((m) => m.score ?? 0);
  const v = scores.length ? Math.max(...scores) / 10 : (ident?.score?.vote_average ?? 0) / 5;
  return Math.max(0, Math.min(100, Math.round(v)));
}

const stripTags = (s) => (s ?? '').replace(/<[^>]+>/g, '').trim();

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
  places.push([display, ll.lat, ll.lon, r.types?.[0] ?? 'place', confidence(r, ident)]);
  placeIndexById.set(r.id, idx);
  const verses = [...(r.verses ?? [])].sort((a, b) => a.sort.localeCompare(b.sort)).map((v) => v.osis);
  const entry = { row: r, idx, ll, verses: new Set(verses) };
  if (!rowsByName.has(display)) rowsByName.set(display, []);
  rowsByName.get(display).push(entry);

  for (const osis of verses) {
    const [book, ch, v] = osis.split('.');
    ((byBook[book] ??= {})[ch] ??= {})[v] ??= new Set();
    byBook[book][ch][v].add(idx);
  }
}

// --- per-place details for info cards
const stories = JSON.parse(fs.readFileSync(path.join(root, 'scripts', 'place-stories.json'), 'utf8'));
const aliasesOf = new Map(); // ancient id -> other dataset names that are "another name for" it
for (const r of rows) {
  // only trust the alias when it's this row's best identification
  const m = /another name for <ancient id="([^"]+)">/.exec(r.identifications?.[0]?.description ?? '');
  if (m) {
    if (!aliasesOf.has(m[1])) aliasesOf.set(m[1], new Set());
    aliasesOf.get(m[1]).add(r.friendly_id.replace(/ \d+$/, ''));
  }
}
const allBaseNames = new Set(rows.map((r) => r.friendly_id.replace(/ \d+$/, '')));
const storyErrors = [];
const storyByFriendly = new Map(Object.entries(stories));
const details = [];
for (const list of rowsByName.values()) {
  for (const { row: r, idx, verses } of list) {
    const display = places[idx][0];
    const seen = new Set([display.toLowerCase()]);
    const aliases = [...(aliasesOf.get(r.id) ?? [])].filter((n) => n !== display);
    aliases.forEach((n) => seen.add(n.toLowerCase()));
    // spelling variants across translations (skip demonyms, epithets and other places' names)
    const alt = [];
    for (const [n] of Object.entries(r.translation_name_counts ?? {}).sort((a, b) => b[1] - a[1])) {
      const k = n.toLowerCase();
      if (seen.has(k) || /^[a-z]/.test(n) || /('s|ites?|ians?|Jews)$/i.test(n) || allBaseNames.has(n) || /^(Judah|Israel|Daughter .*)$/i.test(n)) continue;
      seen.add(k);
      alt.push(n);
    }
    const modern = Object.values(r.modern_associations ?? {})
      .filter((m) => (m.score ?? 0) > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 4)
      .map((m) => [m.name, Math.round(m.score / 10)]);
    const ident = r.identifications?.[0];
    const linked = Object.values(r.linked_data ?? {});
    const wd = linked.map((l) => l.id).find((id) => /^Q\d+$/.test(id ?? ''));
    const factbook = linked.find((l) => /biblia\.com\/factbook/.test(l.url ?? ''))?.url;
    const pleiades = linked.find((l) => /pleiades\.stoa\.org/.test(l.url ?? ''))?.url;
    const st = storyByFriendly.get(r.friendly_id);
    if (st) storyByFriendly.delete(r.friendly_id);
    details[idx] = {
      types: r.types ?? [],
      ...(alt.length && { alt }),
      ...(aliases.length && { aka: aliases }),
      ...(modern.length && { modern }),
      ...(!modern.length && ident?.description && { site: stripTags(ident.description) }),
      refs: [...verses],
      ...(wd && { wd }),
      ...(factbook && { factbook }),
      ...(pleiades && { pleiades }),
      ...(st && { stories: st.map(([t, ref]) => ({ t, ref })) }),
    };
    if (st) for (const [, ref] of st) if (!/^\w+\.\d+\.\d+$/.test(ref)) storyErrors.push(`${r.friendly_id}: bad ref ${ref}`);
  }
}
for (const k of storyByFriendly.keys()) storyErrors.push(`place-stories.json: no place named "${k}"`);
if (storyErrors.length) {
  console.error(storyErrors.join('\n'));
  process.exit(1);
}

// --- write places + per-book verse indexes
const outData = path.join(root, 'public', 'data');
const outVerses = path.join(outData, 'verses');
fs.rmSync(outVerses, { recursive: true, force: true });
fs.mkdirSync(outVerses, { recursive: true });
fs.writeFileSync(path.join(outData, 'places.json'), JSON.stringify(places));
fs.writeFileSync(path.join(outData, 'place-details.json'), JSON.stringify(details));
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
    // `lookup` lets a stop use a different verse to identify which same-named place is meant
    const key = stop.lookup ?? stop.ref;
    const chapter = key.split('.').slice(0, 2).join('.') + '.';
    const pick =
      cands.find((c) => c.verses.has(key)) ??
      cands.find((c) => [...c.verses].some((v) => v.startsWith(chapter))) ??
      (cands.length === 1 ? cands[0] : null);
    if (!pick) {
      errors.push(`${j.id}: could not resolve "${stop.place}" for ${stop.ref} (${cands.length} candidates)`);
      continue;
    }
    stop.lat = pick.ll.lat;
    stop.lon = pick.ll.lon;
    stop.placeIndex = pick.idx;
    delete stop.lookup;
  }
}
if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
fs.writeFileSync(path.join(root, 'src', 'data', 'journeys.json'), JSON.stringify(journeys, null, 1));
console.log(`journeys: ${journeys.length}, stops: ${journeys.reduce((n, j) => n + j.stops.length, 0)}`);
