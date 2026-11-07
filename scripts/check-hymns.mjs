// Checks every scripture reference in src/data/hymns.ts against the app's book list,
// and reports how many chapters get hand-picked hymns. Run: npm run check:hymns (Node 22.6+).
import { BOOKS } from '../src/data/books.ts';
import { HYMNS, BOOK_THEMES, hymnsForChapter } from '../src/data/hymns.ts';

const chapters = new Map(BOOKS.map((b) => [b.osis, b.chapters]));
const errors = [];
const titles = new Set();

for (const h of HYMNS) {
  if (titles.has(h.title)) errors.push(`duplicate hymn: ${h.title}`);
  titles.add(h.title);
  if (!h.themes.length) errors.push(`${h.title}: no themes`);
  for (const ref of [...(h.from ?? []), ...(h.fits ?? [])]) {
    const m = /^([1-3]?[A-Za-z]+)\.(\d+)(?:\.(\d+)(?:-(\d+))?)?$/.exec(ref);
    if (!m) { errors.push(`${h.title}: bad reference "${ref}"`); continue; }
    const max = chapters.get(m[1]);
    if (!max) errors.push(`${h.title}: unknown book in "${ref}"`);
    else if (Number(m[2]) < 1 || Number(m[2]) > max) errors.push(`${h.title}: no chapter ${m[2]} in ${m[1]} ("${ref}")`);
    if (m[4] && Number(m[4]) < Number(m[3])) errors.push(`${h.title}: backwards range "${ref}"`);
  }
}
for (const b of BOOKS) if (!BOOK_THEMES[b.osis]) errors.push(`no themes for book ${b.osis}`);

let picked = 0, total = 0, empty = 0;
for (const b of BOOKS) {
  for (let c = 1; c <= b.chapters; c++) {
    const r = hymnsForChapter(b.osis, c);
    total++;
    if (r.from.length + r.fits.length) picked++;
    if (!r.from.length && !r.fits.length && !r.book.length) empty++;
  }
}
if (empty) errors.push(`${empty} chapters would show no hymns at all`);

console.log(`${HYMNS.length} hymns; ${picked} of ${total} chapters have hand-picked hymns; the rest use book themes.`);
if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log('All hymn references are valid.');
