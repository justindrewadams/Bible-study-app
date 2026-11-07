// Builds the app's Bible-people data from Theographic Bible Metadata
// (CC BY-SA 4.0, https://github.com/robertrouse/theographic-bible-metadata),
// whose biographies come from Easton's Bible Dictionary (1897, public domain).
//
// Outputs (derived data, also CC BY-SA 4.0):
//   public/data/people.json               – index: [slug, title, gender, verseCount, firstRef, name?]
//   public/data/place-people.json         – { placeIndex: { born: [slug], died: [slug] } }
//   public/data/people/<letter>.json      – details per person, sharded by first letter of slug
//   public/data/people-verses/<Book>.json – { chapter: { verse: [personIndex, ...] } }
//
// Run: npm run build:data   (after build-data.mjs, which writes places.json)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cache = path.join(root, 'scripts', '.cache', 'theographic');
const BASE = 'https://raw.githubusercontent.com/robertrouse/theographic-bible-metadata/master/json/';

async function load(name) {
  const file = path.join(cache, `${name}.json`);
  if (!fs.existsSync(file)) {
    fs.mkdirSync(cache, { recursive: true });
    console.log(`Downloading ${name}.json ...`);
    const res = await fetch(BASE + `${name}.json`);
    if (!res.ok) throw new Error(`Download failed: ${res.status}`);
    fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  }
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

const [people, verses, tPlaces, groups] = await Promise.all(
  ['people', 'verses', 'places', 'peopleGroups'].map(load),
);

const osisById = new Map(verses.map((v) => [v.id, v.fields.osisRef]));
const groupName = new Map(groups.map((g) => [g.id, g.fields.groupName]));

// Our own place list (OpenBible), to link birth/death places to place cards.
const ourPlaces = JSON.parse(fs.readFileSync(path.join(root, 'public', 'data', 'places.json'), 'utf8'));
const byName = new Map();
ourPlaces.forEach(([name, lat, lon], i) => {
  if (!byName.has(name)) byName.set(name, []);
  byName.get(name).push({ i, lat, lon });
});
function matchPlace(rec) {
  const f = rec?.fields;
  if (!f) return null;
  const name = (f.displayTitle ?? '').replace(/ \d+$/, '');
  const lat = Number(f.latitude);
  const lon = Number(f.longitude);
  const cands = byName.get(name) ?? [];
  let best = null;
  for (const c of cands) {
    const d = Number.isFinite(lat) ? Math.hypot(c.lat - lat, c.lon - lon) : 0;
    if (!best || d < best.d) best = { ...c, d };
  }
  if (best && best.d < 0.6) return { name, place: best.i };
  return Number.isFinite(lat) ? { name, lat: +lat.toFixed(4), lon: +lon.toFixed(4) } : { name };
}
const placeById = new Map(tPlaces.map((p) => [p.id, p]));

// Canonical verse order for sorting references.
const order = new Map(verses.map((v, i) => [v.fields.osisRef, i]));

const recs = people.map((p) => p.fields);
const slugById = new Map(people.map((p) => [p.id, p.fields.slug]));
const idx = new Map(recs.map((f, i) => [f.slug, i]));

// People that would be noise if linked from every verse they appear in.
const NOT_IN_VERSES = new Set(['god_1324', 'holy_spirit_1580']);

const index = [];
const shards = {};
const byBook = {};
const placePeople = {};
for (const [i, f] of recs.entries()) {
  const refs = (f.verses ?? [])
    .map((id) => osisById.get(id))
    .filter(Boolean)
    .sort((a, b) => order.get(a) - order.get(b));
  const title = (f.displayTitle ?? f.name).trim();
  const entry = [f.slug, title, f.gender === 'Female' ? 'F' : f.gender === 'Male' ? 'M' : '', refs.length, refs[0] ?? ''];
  // the name as written in the text, when it differs from the title ("Jesus" vs "Jesus Christ")
  if (f.name && f.name !== title.replace(/\s*\(.*\)\s*$/, '')) entry.push(f.name);
  index.push(entry);

  const rel = (ids) => (ids ?? []).map((id) => slugById.get(id)).filter(Boolean);
  const year = (y) => (y != null && y !== '' && Number.isFinite(Number(y)) ? Number(y) : undefined);
  const bio = (f.dictText?.length ? f.dictText : f.dictionaryText ? [f.dictionaryText] : [])
    .map((t) => t.replace(/\s+/g, ' ').replace(/^'?=/, '').trim())
    .filter(Boolean);
  const d = {
    name: f.name,
    ...(f.alsoCalled && { aka: String(f.alsoCalled).split(',').map((n) => n.trim()).filter(Boolean) }),
    ...(f.memberOf?.length && { groups: f.memberOf.map((g) => groupName.get(g)).filter(Boolean) }),
    ...(year(f.birthYear) != null && { born: year(f.birthYear) }),
    ...(year(f.deathYear) != null && { died: year(f.deathYear) }),
    ...(f.birthPlace?.length && { bornAt: matchPlace(placeById.get(f.birthPlace[0])) }),
    ...(f.deathPlace?.length && { diedAt: matchPlace(placeById.get(f.deathPlace[0])) }),
    ...(f.father?.length && { father: rel(f.father) }),
    ...(f.mother?.length && { mother: rel(f.mother) }),
    ...(f.partners?.length && { spouses: rel(f.partners) }),
    ...((f.siblings?.length || f.halfSiblingsSameFather?.length || f.halfSiblingsSameMother?.length) && {
      siblings: [...new Set([...rel(f.siblings), ...rel(f.halfSiblingsSameFather), ...rel(f.halfSiblingsSameMother)])],
    }),
    ...(f.children?.length && { children: rel(f.children) }),
    ...(bio.length && { bio }),
    refs,
  };
  for (const [key, at] of [['born', d.bornAt], ['died', d.diedAt]]) {
    if (at?.place == null) continue;
    ((placePeople[at.place] ??= {})[key] ??= []).push(f.slug);
  }
  const letter = f.slug[0].toLowerCase().replace(/[^a-z]/, '_');
  (shards[letter] ??= {})[f.slug] = d;

  if (NOT_IN_VERSES.has(f.slug)) continue;
  for (const osis of refs) {
    const [b, c, v] = osis.split('.');
    (((byBook[b] ??= {})[c] ??= {})[v] ??= []).push(i);
  }
}

const out = path.join(root, 'public', 'data');
fs.writeFileSync(path.join(out, 'people.json'), JSON.stringify(index));
fs.writeFileSync(path.join(out, 'place-people.json'), JSON.stringify(placePeople));
for (const dir of ['people', 'people-verses']) fs.rmSync(path.join(out, dir), { recursive: true, force: true });
fs.mkdirSync(path.join(out, 'people'), { recursive: true });
fs.mkdirSync(path.join(out, 'people-verses'), { recursive: true });
for (const [letter, data] of Object.entries(shards)) fs.writeFileSync(path.join(out, 'people', `${letter}.json`), JSON.stringify(data));
for (const [book, data] of Object.entries(byBook)) fs.writeFileSync(path.join(out, 'people-verses', `${book}.json`), JSON.stringify(data));

// Verses per chapter (all 66 books), used to keep each screen of a licensed
// translation within its publisher's limits (e.g. at most half of a book).
const verseCounts = {};
for (const v of verses) {
  const [b, c] = v.fields.osisRef.split('.');
  ((verseCounts[b] ??= [])[Number(c) - 1] ??= 0);
  verseCounts[b][Number(c) - 1]++;
}
fs.writeFileSync(path.join(root, 'src', 'data', 'verseCounts.json'), JSON.stringify(verseCounts));

const linked = Object.values(shards).flatMap((s) => Object.values(s)).filter((d) => d.bornAt?.place != null || d.diedAt?.place != null).length;
console.log(`people: ${index.length}, shards: ${Object.keys(shards).length}, books: ${Object.keys(byBook).length}, with linked places: ${linked}`);
