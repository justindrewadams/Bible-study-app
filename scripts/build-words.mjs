// Builds the Hebrew & Greek word-study data from STEPBible (Tyndale House, Cambridge), CC BY 4.0:
//   TAHOT (Hebrew OT) and TAGNT (Greek NT): every word with Strong's number, grammar and English gloss
//   TBESH / TBESG: brief Hebrew and Greek lexicons (from BDB and Abbott-Smith, public domain)
//   TEHMC / TEGMC: expansions of the grammar codes
// Raw files are downloaded to scripts/.cache/step (git-ignored). Run: npm run build:words
//
// Outputs (public/data):
//   words/<Book>/<c>.json    { "v": [[word, translit, gloss, strong, grammar, kjvOnly?], ...] }
//   lexicon/<H|G><n>.json    { strong: [lemma, translit, gloss, definition, verseCount, refs[]] }  (n = number / 500)
//   grammar-H.json, grammar-G.json   { code: "plain English" }

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cache = path.join(root, 'scripts', '.cache', 'step');
const out = path.join(root, 'public', 'data');
const REPO = 'https://raw.githubusercontent.com/STEPBible/STEPBible-Data/master/';

const SOURCES = {
  'TAHOT_Gen-Deu.txt': 'Translators Amalgamated OT+NT/TAHOT Gen-Deu - Translators Amalgamated Hebrew OT - STEPBible.org CC BY.txt',
  'TAHOT_Jos-Est.txt': 'Translators Amalgamated OT+NT/TAHOT Jos-Est - Translators Amalgamated Hebrew OT - STEPBible.org CC BY.txt',
  'TAHOT_Job-Sng.txt': 'Translators Amalgamated OT+NT/TAHOT Job-Sng - Translators Amalgamated Hebrew OT - STEPBible.org CC BY.txt',
  'TAHOT_Isa-Mal.txt': 'Translators Amalgamated OT+NT/TAHOT Isa-Mal - Translators Amalgamated Hebrew OT - STEPBible.org CC BY.txt',
  'TAGNT_Mat-Jhn.txt': 'Translators Amalgamated OT+NT/TAGNT Mat-Jhn - Translators Amalgamated Greek NT - STEPBible.org CC-BY.txt',
  'TAGNT_Act-Rev.txt': 'Translators Amalgamated OT+NT/TAGNT Act-Rev - Translators Amalgamated Greek NT - STEPBible.org CC-BY.txt',
  'TBESH.txt': 'Lexicons/TBESH - Translators Brief lexicon of Extended Strongs for Hebrew - STEPBible.org CC BY.txt',
  'TBESG.txt': 'Lexicons/TBESG - Translators Brief lexicon of Extended Strongs for Greek - STEPBible.org CC BY.txt',
  'TEHMC.txt': 'Morphology codes/TEHMC - Translators Expansion of Hebrew Morphology Codes - STEPBible.org CC BY.txt',
  'TEGMC.txt': 'Morphology codes/TEGMC - Translators Expansion of Greek Morphhology Codes - STEPBible.org CC BY.txt',
};

// STEPBible book codes → the app's OSIS codes
const BOOK = {
  Gen: 'Gen', Exo: 'Exod', Lev: 'Lev', Num: 'Num', Deu: 'Deut', Jos: 'Josh', Jdg: 'Judg', Rut: 'Ruth',
  '1Sa': '1Sam', '2Sa': '2Sam', '1Ki': '1Kgs', '2Ki': '2Kgs', '1Ch': '1Chr', '2Ch': '2Chr', Ezr: 'Ezra',
  Neh: 'Neh', Est: 'Esth', Job: 'Job', Psa: 'Ps', Pro: 'Prov', Ecc: 'Eccl', Sng: 'Song', Isa: 'Isa',
  Jer: 'Jer', Lam: 'Lam', Ezk: 'Ezek', Dan: 'Dan', Hos: 'Hos', Jol: 'Joel', Amo: 'Amos', Oba: 'Obad',
  Jon: 'Jonah', Mic: 'Mic', Nam: 'Nah', Hab: 'Hab', Zep: 'Zeph', Hag: 'Hag', Zec: 'Zech', Mal: 'Mal',
  Mat: 'Matt', Mrk: 'Mark', Luk: 'Luke', Jhn: 'John', Act: 'Acts', Rom: 'Rom', '1Co': '1Cor', '2Co': '2Cor',
  Gal: 'Gal', Eph: 'Eph', Php: 'Phil', Col: 'Col', '1Th': '1Thess', '2Th': '2Thess', '1Ti': '1Tim',
  '2Ti': '2Tim', Tit: 'Titus', Phm: 'Phlm', Heb: 'Heb', Jas: 'Jas', '1Pe': '1Pet', '2Pe': '2Pet',
  '1Jn': '1John', '2Jn': '2John', '3Jn': '3John', Jud: 'Jude', Rev: 'Rev',
};

async function ensure(file) {
  const p = path.join(cache, file);
  if (fs.existsSync(p)) return p;
  fs.mkdirSync(cache, { recursive: true });
  console.log(`downloading ${file}…`);
  const r = await fetch(REPO + encodeURI(SOURCES[file]).replace(/\+/g, '%2B'));
  if (!r.ok) throw new Error(`${file}: HTTP ${r.status}`);
  fs.writeFileSync(p, Buffer.from(await r.arrayBuffer()));
  return p;
}

const lines = (p) => fs.readFileSync(p, 'utf8').split(/\r?\n/);

// ---------------------------------------------------------------- words
const books = new Map(); // osis -> { "c.v": [...] }
const occ = new Map(); // strong -> Set of "Book.c.v"
const usedGrammar = { H: new Set(), G: new Set() };

function addWord(osis, c, v, entry, strong) {
  let b = books.get(osis);
  if (!b) books.set(osis, (b = {}));
  (b[`${c}.${v}`] ??= []).push(entry);
  if (strong) {
    let s = occ.get(strong);
    if (!s) occ.set(strong, (s = new Set()));
    s.add(`${osis}.${c}.${v}`);
  }
}

/** "{H7225G}" in a "/"-separated list → the main word's strong and its index */
function mainStrong(field) {
  const parts = field.split('/');
  const i = Math.max(0, parts.findIndex((p) => p.includes('{')));
  const m = /[HG]\d{4}[A-Za-z]?/.exec(parts[i] ?? '');
  return { strong: m?.[0] ?? '', index: i };
}

for (const file of ['TAHOT_Gen-Deu.txt', 'TAHOT_Jos-Est.txt', 'TAHOT_Job-Sng.txt', 'TAHOT_Isa-Mal.txt']) {
  const seen = new Set();
  for (const line of lines(await ensure(file))) {
    const m = /^([1-3]?[A-Za-z]{2,3})\.(\d+)\.(\d+)(?:\([\d.]+\))?#(\d+)=([A-Za-z]+)/.exec(line);
    if (!m) continue;
    const [, bk, c, v, n, type] = m;
    if (type.startsWith('X')) continue; // words supplied only from the Greek (LXX)
    const key = `${bk}.${c}.${v}#${n}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const f = line.split('\t');
    const word = f[1].replace(/[/\\]/g, '').replace(/׃/g, '').trim();
    const translit = f[2].replace(/[/.]/g, '').toLowerCase();
    const gloss = f[3].replace(/\/\s*/g, ' ').replace(/\s+/g, ' ').trim();
    const { strong } = mainStrong(f[4]);
    const grammar = f[5].trim();
    const lang = grammar[0] === 'A' ? 'A' : 'H';
    for (const p of grammar.split('/')) usedGrammar.H.add((p.startsWith(lang) ? '' : lang) + p);
    if (!word || !BOOK[bk]) continue;
    addWord(BOOK[bk], Number(c), Number(v), [word, translit, gloss, strong, grammar], strong);
  }
}

for (const file of ['TAGNT_Mat-Jhn.txt', 'TAGNT_Act-Rev.txt']) {
  for (const line of lines(await ensure(file))) {
    const m = /^([1-3]?[A-Za-z]{2,3})\.(\d+)\.(\d+)#(\d+)=([A-Za-z]+)/.exec(line);
    if (!m) continue;
    const [, bk, c, v, , type] = m;
    const modern = /n/i.test(type);
    const kjv = /k/i.test(type);
    if (!modern && !kjv) continue; // other manuscripts, rarely translated
    const f = line.split('\t');
    const wm = /^(.*?)\s*\((.*)\)\s*$/.exec(f[1]);
    const word = (wm?.[1] ?? f[1]).trim();
    const translit = (wm?.[2] ?? '').trim();
    const gloss = f[2].trim();
    const [strongRaw, grammar = ''] = f[3].split('=');
    const strong = /G\d{4}[A-Za-z]?/.exec(strongRaw)?.[0] ?? '';
    usedGrammar.G.add(grammar.trim());
    const entry = [word, translit, gloss, strong, grammar.trim()];
    if (!modern) entry.push(1); // only in the KJV's Greek (Textus Receptus)
    addWord(BOOK[bk], Number(c), Number(v), entry, modern ? strong : '');
  }
}

// one small file per chapter: words/<Book>/<chapter>.json  { verse: [[…word…], …] }
fs.rmSync(path.join(out, 'words'), { recursive: true, force: true });
for (const [osis, data] of books) {
  const dir = path.join(out, 'words', osis);
  fs.mkdirSync(dir, { recursive: true });
  const byChapter = new Map();
  for (const [cv, ws] of Object.entries(data)) {
    const [c, v] = cv.split('.');
    let ch = byChapter.get(c);
    if (!ch) byChapter.set(c, (ch = {}));
    ch[v] = ws;
  }
  for (const [c, ch] of byChapter) fs.writeFileSync(path.join(dir, `${c}.json`), JSON.stringify(ch));
}

// ---------------------------------------------------------------- grammar
const TITLE = { Person: 'person', Stem: 'stem' };
function plainGrammar(desc) {
  // "Function=Verb ; Stem=Qal (hence Action=Simple; Voice=Active); Person=Third; …" → "Verb · Qal stem (simple, active) · third person · …"
  const parts = [];
  let depth = 0;
  let cur = '';
  for (const ch of desc) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ';' && depth === 0) {
      parts.push(cur);
      cur = '';
    } else cur += ch;
  }
  parts.push(cur);
  return parts
    .map((p) => {
      const m = /^\s*([A-Za-z ]+?)\s*=\s*([^()]+?)\s*(?:\((.*)\))?\s*$/.exec(p);
      if (!m) return p.trim();
      const [, k, val, extra] = m;
      let s = TITLE[k] ? `${val} ${TITLE[k]}` : val;
      if (extra) {
        const vals = extra
          .replace(/^hence\s*/i, '')
          .split(';')
          .map((x) => x.split('=')[1]?.trim().toLowerCase())
          .filter(Boolean);
        if (vals.length) s += ` (${vals.join(', ')})`;
      }
      return s;
    })
    .filter(Boolean)
    .join(' · ');
}

for (const [lang, file] of [
  ['H', 'TEHMC.txt'],
  ['G', 'TEGMC.txt'],
]) {
  const map = {};
  for (const line of lines(await ensure(file))) {
    const [code, desc] = line.split('\t');
    if (!code || !desc || !usedGrammar[lang].has(code.trim()) || !/=/.test(desc)) continue;
    map[code.trim()] ??= plainGrammar(desc.trim());
  }
  fs.writeFileSync(path.join(out, `grammar-${lang}.json`), JSON.stringify(map));
  console.log(`grammar-${lang}: ${Object.keys(map).length} of ${usedGrammar[lang].size} codes explained`);
}

// ---------------------------------------------------------------- lexicons
/** Lexicon HTML → safe segments: [text] | [text, "b"|"i"] | [label, "r", "Book.c.v"] | ["\n"] */
function segments(html) {
  const segs = [];
  let bold = 0;
  let ital = 0;
  const push = (text) => {
    text = text
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/__/g, '');
    if (!text) return;
    const style = bold ? 'b' : ital ? 'i' : null;
    segs.push(style ? [text, style] : [text]);
  };
  const re = /<ref='([^']*)'>(.*?)<\/ref>|<(\/?)([a-zA-Z]+)[^>]*>/g;
  let last = 0;
  for (const m of html.matchAll(re)) {
    push(html.slice(last, m.index));
    last = m.index + m[0].length;
    if (m[1] != null) {
      const r = /^([1-3]?[A-Za-z]{2,3})\.(\d+)\.(\d+)/.exec(m[1]);
      const label = m[2].replace(/<[^>]+>/g, '');
      if (r && BOOK[r[1]]) segs.push([label, 'r', `${BOOK[r[1]]}.${r[2]}.${r[3]}`]);
      else push(label);
      continue;
    }
    const closing = m[3] === '/';
    const tag = m[4].toLowerCase();
    if (tag === 'br') segs.push(['\n']);
    else if (tag === 'b') bold += closing ? -1 : 1;
    else if (tag === 'i') ital += closing ? -1 : 1;
  }
  push(html.slice(last));
  // merge neighbouring plain text
  const merged = [];
  for (const s of segs) {
    const prev = merged[merged.length - 1];
    if (prev && s.length === 1 && prev.length === 1 && s[0] !== '\n' && prev[0] !== '\n') prev[0] += s[0];
    else merged.push(s);
  }
  while (merged.length && merged[0][0] === '\n') merged.shift();
  return merged;
}

const MAX_REFS = 250;
const shards = new Map();
for (const file of ['TBESH.txt', 'TBESG.txt']) {
  for (const line of lines(await ensure(file))) {
    if (!/^[HG]\d{4}/.test(line)) continue;
    const f = line.split('\t');
    const strong = /^[HG]\d{4}[A-Za-z]?/.exec(f[1] ?? '')?.[0];
    if (!strong) continue;
    const refs = [...(occ.get(strong) ?? [])];
    const shard = `${strong[0]}${Math.floor(Number(strong.slice(1, 5)) / 500)}`;
    let s = shards.get(shard);
    if (!s) shards.set(shard, (s = {}));
    if (s[strong]) continue;
    s[strong] = [f[3], f[4], f[6], segments(f[7] ?? ''), refs.length, refs.slice(0, MAX_REFS)];
  }
}
fs.mkdirSync(path.join(out, 'lexicon'), { recursive: true });
for (const [name, data] of shards) fs.writeFileSync(path.join(out, 'lexicon', `${name}.json`), JSON.stringify(data));

// ---------------------------------------------------------------- report
const missing = [...occ.keys()].filter((s) => !shards.get(`${s[0]}${Math.floor(Number(s.slice(1, 5)) / 500)}`)?.[s]);
const words = [...books.values()].reduce((n, b) => n + Object.values(b).reduce((m, w) => m + w.length, 0), 0);
console.log(`words: ${books.size} books, ${words.toLocaleString()} words; lexicon: ${shards.size} files`);
console.log(`${missing.length} Strong's numbers used in the text have no lexicon entry (e.g. ${missing.slice(0, 8).join(', ')})`);
