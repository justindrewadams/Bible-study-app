/**
 * Finding the nations of the Nations page in a verse.
 *
 * Two kinds of words:
 * - people-group words ("Philistines", "Egyptians", "Romans") are never anything else, so they are
 *   underlined in the text and open the nation's card;
 * - country words ("Egypt", "Moab", "Babylon") are usually already places (or people: Moab, Ammon), so they are
 *   only listed in the verse bar under "Nations".
 * The bare words "Israel" and "Judah" are left out: they appear in most Old Testament verses and also name
 * Jacob and his son. "Israelites", "Hebrews" and "Jews" still count.
 */
import { NATIONS, type Nation } from '../data/nations';

/** People-group words, underlined in the text. Matched case-sensitively as whole words. */
const GROUP_WORDS: Record<string, string[]> = {
  israel: ['Israelites', 'Israelite', 'Hebrews', 'Hebrew'],
  judah: ['Jews', 'Jew', 'Jewish', 'Jewess'],
  edom: ['Edomites', 'Edomite', 'Idumeans'],
  amalek: ['Amalekites', 'Amalekite'],
  moab: ['Moabites', 'Moabite', 'Moabitess'],
  ammon: ['Ammonites', 'Ammonite', 'Ammonitess'],
  ishmaelites: ['Ishmaelites', 'Ishmaelite', 'Arabians', 'Arabs'],
  midian: ['Midianites', 'Midianite'],
  aram: ['Arameans', 'Aramean', 'Syrians', 'Syrian'],
  assyria: ['Assyrians', 'Assyrian'],
  elam: ['Elamites'],
  sheba: ['Sabeans'],
  egypt: ['Egyptians', 'Egyptian'],
  cush: ['Cushites', 'Cushite', 'Ethiopians', 'Ethiopian'],
  put: ['Libyans'],
  babylon: ['Babylonians', 'Chaldeans', 'Chaldean'],
  canaanites: ['Canaanites', 'Canaanite', 'Canaanitess'],
  phoenicia: ['Phoenicians', 'Sidonians'],
  hittites: ['Hittites', 'Hittite'],
  amorites: ['Amorites', 'Amorite'],
  jebusites: ['Jebusites', 'Jebusite'],
  hivites: ['Hivites', 'Hivite', 'Gibeonites'],
  philistines: ['Philistines', 'Philistine'],
  medes: ['Medes', 'Mede'],
  greece: ['Greeks', 'Greek', 'Grecians'],
  persia: ['Persians', 'Persian'],
  rome: ['Romans', 'Roman'],
  samaritans: ['Samaritans', 'Samaritan'],
  kenites: ['Kenites', 'Kenite'],
  anakim: ['Anakim', 'Anakites'],
};

/** Country words: listed in the verse bar only. */
const COUNTRY_WORDS: Record<string, string[]> = {
  edom: ['Edom', 'Idumea'],
  amalek: ['Amalek'],
  moab: ['Moab'],
  ammon: ['Ammon'],
  midian: ['Midian'],
  aram: ['Aram', 'Syria'],
  assyria: ['Assyria'],
  elam: ['Elam'],
  sheba: ['Sheba'],
  egypt: ['Egypt'],
  cush: ['Cush', 'Ethiopia'],
  put: ['Put', 'Libya'],
  babylon: ['Babylon', 'Chaldea', 'Shinar'],
  canaanites: ['Canaan'],
  phoenicia: ['Phoenicia'],
  philistines: ['Philistia'],
  medes: ['Media'],
  greece: ['Greece', 'Javan'],
  magog: ['Magog', 'Meshech', 'Tubal'],
  persia: ['Persia'],
  rome: ['Rome'],
  samaritans: ['Samaria'],
};

const byId = new Map(NATIONS.map((n) => [n.id, n]));
const wordToNation = new Map<string, Nation>();
const countryToNation = new Map<string, Nation>();
for (const [id, words] of Object.entries(GROUP_WORDS)) for (const w of words) wordToNation.set(w, byId.get(id)!);
for (const [id, words] of Object.entries(COUNTRY_WORDS)) for (const w of words) countryToNation.set(w, byId.get(id)!);

const wordsRe = (words: string[]) =>
  new RegExp(`(?<![\\w’'-])(${[...words].sort((a, b) => b.length - a.length).join('|')})(?![\\w-])`, 'g');
const GROUP_RE = wordsRe([...wordToNation.keys()]);
const ALL_RE = wordsRe([...wordToNation.keys(), ...countryToNation.keys()]);

/** The nation a people-group word belongs to ("Philistines" → Philistines), or undefined. */
export const nationForWord = (word: string): Nation | undefined => wordToNation.get(word);

/** People-group words in a verse, for underlining: [start, end, nation]. */
export function nationWordsIn(text: string): [number, number, Nation][] {
  return [...text.matchAll(GROUP_RE)].map((m) => [m.index!, m.index! + m[0].length, wordToNation.get(m[0])!]);
}

/** Every nation a verse names, by people-group or country word, in order of first mention. */
export function nationsInVerse(text: string): Nation[] {
  const out: Nation[] = [];
  for (const m of text.matchAll(ALL_RE)) {
    const n = wordToNation.get(m[0]) ?? countryToNation.get(m[0]);
    if (n && !out.includes(n)) out.push(n);
  }
  return out;
}
