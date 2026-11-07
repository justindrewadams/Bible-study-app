// Checks every person link and verse reference in src/data/nations.ts. Run: npm run check:nations (Node 22.6+).
import fs from 'node:fs';
import { BOOKS } from '../src/data/books.ts';
import { NATIONS } from '../src/data/nations.ts';

const slugs = new Set(JSON.parse(fs.readFileSync(new URL('../public/data/people.json', import.meta.url))).map((r) => r[0]));
const chapters = new Map(BOOKS.map((b) => [b.osis, b.chapters]));
const errors = [];
const ids = new Set();
for (const n of NATIONS) {
  if (ids.has(n.id)) errors.push(`duplicate id ${n.id}`);
  ids.add(n.id);
  for (const s of [...(n.line ?? []), ...(n.related ?? []).map((r) => r.slug)])
    if (!slugs.has(s)) errors.push(`${n.name}: no person "${s}"`);
  for (const { ref } of n.refs) {
    const m = /^([1-3]?[A-Za-z]+)\.(\d+)\.(\d+)$/.exec(ref);
    if (!m || !chapters.has(m[1]) || Number(m[2]) > chapters.get(m[1])) errors.push(`${n.name}: bad reference ${ref}`);
  }
}
console.log(`${NATIONS.length} nations checked.`);
if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log('All person links and references are valid.');
