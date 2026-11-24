/**
 * Builds the data for searching Bible wording (the "Verses" results of the site search):
 *
 *   public/data/search/web.json   the World English Bible text (public domain; eBible.org's 2020 stable
 *                                 edition, unchanged), used to find verses by their English wording
 *   public/data/search/orig.json  the Hebrew and Greek words (Strong's numbers) in every verse, and which
 *                                 English words stand for them, from the app's STEPBible word-study data
 *                                 (CC BY 4.0) in public/data/words and public/data/lexicon
 *
 * Run: npm run build:verse-search (downloads ~5 MB into scripts/.cache/web on first run;
 * needs public/data/words from `npm run build:words`)
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { STOP_WORDS, stem, words } from '../src/lib/stem.ts';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const cache = path.join(root, 'scripts', '.cache', 'web');
const vpl = path.join(cache, 'eng-web_vpl.txt');
const out = path.join(root, 'public', 'data', 'search');

if (!fs.existsSync(vpl)) {
  fs.mkdirSync(cache, { recursive: true });
  const zip = path.join(cache, 'eng-web_vpl.zip');
  console.log('Downloading the World English Bible…');
  const res = await fetch('https://ebible.org/Scriptures/eng-web_vpl.zip');
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);
  fs.writeFileSync(zip, Buffer.from(await res.arrayBuffer()));
  execFileSync('unzip', ['-o', '-q', zip, '-d', cache]);
}

// eBible's book codes -> the app's OSIS codes (the 66 books; deuterocanonical books are skipped)
const CODES = {
  GEN: 'Gen', EXO: 'Exod', LEV: 'Lev', NUM: 'Num', DEU: 'Deut', JOS: 'Josh', JDG: 'Judg', RUT: 'Ruth',
  '1SA': '1Sam', '2SA': '2Sam', '1KI': '1Kgs', '2KI': '2Kgs', '1CH': '1Chr', '2CH': '2Chr', EZR: 'Ezra',
  NEH: 'Neh', EST: 'Esth', JOB: 'Job', PSA: 'Ps', PRO: 'Prov', ECC: 'Eccl', SOL: 'Song', ISA: 'Isa',
  JER: 'Jer', LAM: 'Lam', EZE: 'Ezek', DAN: 'Dan', HOS: 'Hos', JOE: 'Joel', AMO: 'Amos', OBA: 'Obad',
  JON: 'Jonah', MIC: 'Mic', NAH: 'Nah', HAB: 'Hab', ZEP: 'Zeph', HAG: 'Hag', ZEC: 'Zech', MAL: 'Mal',
  MAT: 'Matt', MAR: 'Mark', LUK: 'Luke', JOH: 'John', ACT: 'Acts', ROM: 'Rom', '1CO': '1Cor', '2CO': '2Cor',
  GAL: 'Gal', EPH: 'Eph', PHI: 'Phil', COL: 'Col', '1TH': '1Thess', '2TH': '2Thess', '1TI': '1Tim',
  '2TI': '2Tim', TIT: 'Titus', PHM: 'Phlm', HEB: 'Heb', JAM: 'Jas', '1PE': '1Pet', '2PE': '2Pet',
  '1JO': '1John', '2JO': '2John', '3JO': '3John', JUD: 'Jude', REV: 'Rev',
};

// ---- the WEB text: { Gen: [[verse 1, verse 2, …] /* chapter 1 */, …], … }
const web = {};
let verseTotal = 0;
for (const line of fs.readFileSync(vpl, 'utf8').split('\n')) {
  const m = /^(\w{3}) (\d+):(\d+) (.*)$/.exec(line.trim());
  if (!m || !CODES[m[1]]) continue;
  const book = (web[CODES[m[1]]] ??= []);
  const ch = (book[Number(m[2]) - 1] ??= []);
  ch[Number(m[3]) - 1] = m[4];
  verseTotal++;
}
for (const book of Object.values(web)) for (let c = 0; c < book.length; c++) book[c] = Array.from(book[c] ?? [], (v) => v ?? '');
if (Object.keys(web).length !== 66) throw new Error(`expected 66 books, got ${Object.keys(web).length}`);

// ---- Hebrew/Greek words per verse, from the word-study data. Codes: H123 -> 123, G123 -> 20123
const code = (strong) => {
  const m = /^([HG])(\d+)/.exec(strong ?? '');
  return m ? (m[1] === 'G' ? 20000 : 0) + Number(m[2]) : null;
};
const wordsDir = path.join(root, 'public', 'data', 'words');
const verses = {}; // book -> chapter -> verse -> Set(code)
const df = new Map(); // code -> number of verses
const occ = new Map(); // code -> number of occurrences
const pair = new Map(); // `${stem} ${code}` -> count
const glossOf = (g) => words(g.replace(/\[[^\]]*\]|<[^>]*>/g, ' ')).filter((w) => !STOP_WORDS.has(w) && w.length > 1).map(stem);
let wordTotal = 0;
for (const book of Object.keys(web)) {
  const dir = path.join(wordsDir, book);
  if (!fs.existsSync(dir)) throw new Error(`missing word data for ${book} (run npm run build:words)`);
  verses[book] = [];
  for (const file of fs.readdirSync(dir)) {
    const ch = Number(file.replace('.json', ''));
    const data = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
    const chapter = (verses[book][ch - 1] = []);
    for (const [v, ws] of Object.entries(data)) {
      const set = new Set();
      for (const w of ws) {
        const c = code(w[3]);
        if (c == null) continue;
        wordTotal++;
        set.add(c);
        occ.set(c, (occ.get(c) ?? 0) + 1);
        for (const s of glossOf(w[2] ?? '')) pair.set(`${s} ${c}`, (pair.get(`${s} ${c}`) ?? 0) + 1);
      }
      for (const c of set) df.set(c, (df.get(c) ?? 0) + 1);
      chapter[Number(v) - 1] = set;
    }
  }
}

// lexicon glosses and short definitions count as strong evidence for a word's English meaning
const lexDir = path.join(root, 'public', 'data', 'lexicon');
for (const file of fs.readdirSync(lexDir)) {
  const shard = JSON.parse(fs.readFileSync(path.join(lexDir, file), 'utf8'));
  for (const [id, entry] of Object.entries(shard)) {
    const c = code(id);
    if (c == null || !occ.has(c)) continue;
    const defs = (entry[3] ?? []).flat().filter((x) => typeof x === 'string').join(' ').slice(0, 160);
    for (const s of new Set([...glossOf(String(entry[2] ?? '')), ...glossOf(defs)]))
      pair.set(`${s} ${c}`, (pair.get(`${s} ${c}`) ?? 0) + Math.max(3, Math.round(occ.get(c) * 0.2)));
  }
}

// A few English renderings that the glosses above don't reach (common in modern translations).
// Original to this app; Strong's numbers: H2617 chesed, G2434/G2435 propitiation, G1343 righteousness.
const EXTRA = {
  steadfast: [2617],
  lovingkindnes: [2617],
  mercy: [2617],
  propitiation: [22434, 22435],
  atonement: [3722, 22434],
  righteousnes: [21343, 6666],
};

// keep each English word's typical Hebrew/Greek words: the word must be a usual rendering of it
const vocab = {};
for (const [k, n] of pair) {
  const [s, cs] = k.split(' ');
  const c = Number(cs);
  if (n < 2 || n < (occ.get(c) ?? 0) * 0.12) continue;
  (vocab[s] ??= []).push([c, n]);
}
for (const s of Object.keys(vocab)) vocab[s] = vocab[s].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([c]) => c);
for (const [s, cs] of Object.entries(EXTRA)) vocab[s] = [...new Set([...cs, ...(vocab[s] ?? [])])];

// drop words found in very many verses ("the", "and", "God"): they don't tell verses apart
const COMMON = 2500;
const orig = {};
let kept = 0;
for (const [book, chapters] of Object.entries(verses)) {
  orig[book] = web[book].map((wc, c) =>
    wc.map((_, v) => {
      const set = chapters[c]?.[v];
      if (!set) return [];
      const list = [...set].filter((x) => df.get(x) <= COMMON).sort((a, b) => a - b);
      kept += list.length;
      return list;
    }),
  );
}

fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(
  path.join(out, 'web.json'),
  JSON.stringify({ source: 'World English Bible (2020 stable text, eBible.org), public domain. Unchanged.', books: web }),
);
fs.writeFileSync(
  path.join(out, 'orig.json'),
  JSON.stringify({
    source:
      "Hebrew and Greek words per verse and their usual English renderings, derived from STEPBible Data (Tyndale House, Cambridge; CC BY 4.0). Codes: Strong's H n = n, G n = 20000 + n.",
    vocab,
    verses: orig,
  }),
);
const kb = (f) => (fs.statSync(path.join(out, f)).size / 1024).toFixed(0);
console.log(
  `verse search: ${verseTotal} WEB verses (${kb('web.json')} KB); ${wordTotal} original words, ${kept} kept in the index; ${Object.keys(vocab).length} English words linked (${kb('orig.json')} KB)`,
);
