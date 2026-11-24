/**
 * Word handling shared by verse search (src/lib/verseSearch.ts) and its build script
 * (scripts/build-verse-search.mjs), so both reduce words the same way. No imports: the build
 * script loads this file directly.
 */

/** Words too common to tell verses apart (modern and King James forms). */
export const STOP_WORDS = new Set(
  (
    'a an and are as at be been but by for from had has have he her hers him his i if in into is it its me my ' +
    'no nor not of on or our ours she so than that the their them then there these they this those to up us ' +
    'was we were what when which who whom will with you your yours all any also am do did does done shall ' +
    'should would could may might must let unto upon thee thou thy thine ye hath doth art wilt shalt o oh ' +
    'one out over said says say saying about after again against before being between both each even ever ' +
    'every here how just like more most much now only other own same some such through under very where why yet'
  ).split(' '),
);

/** Lower case, no accents, straight apostrophes. */
export function fold(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[‘’`]/g, "'");
}

/** God's name, written "LORD" in most English Bibles and "Yahweh" or "Jehovah" in some. */
const SAME_WORD: Record<string, string> = { yahweh: 'lord', jehovah: 'lord' };

/** Words of a text, folded, with possessives dropped ("God's" → "god"). */
export function words(s: string): string[] {
  return fold(s)
    .replace(/'s\b/g, '')
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .map((w) => SAME_WORD[w] ?? w);
}

const doubled = /([bdfgklmnprst])\1$/;

/**
 * A light stemmer: enough to treat "sin", "sins", "sinned" and "sinneth" (or "love", "loved",
 * "loving") as one word. Not a full linguistic stemmer: it only needs to be consistent.
 */
export function stem(w: string): string {
  let s = w;
  if (s.length <= 3) return s;
  if (s.endsWith('ies') && s.length > 4) s = s.slice(0, -3) + 'y';
  else if (s.endsWith('ied') && s.length > 4) s = s.slice(0, -3) + 'y';
  else if (s.endsWith('sses')) s = s.slice(0, -2);
  else if (s.endsWith('s') && !/(ss|us|is)$/.test(s)) s = s.slice(0, -1);
  if (s.endsWith('ing') && s.length > 5) s = s.slice(0, -3);
  else if (s.endsWith('eth') && s.length > 5) s = s.slice(0, -3);
  else if (s.endsWith('est') && s.length > 6) s = s.slice(0, -3);
  else if (s.endsWith('ed') && s.length > 4) s = s.slice(0, -2);
  if (doubled.test(s) && s.length > 3) s = s.slice(0, -1);
  if (s.endsWith('e') && s.length > 3) s = s.slice(0, -1);
  return s;
}

/** The meaningful stems of a text, in order (stop words removed). */
export function contentStems(s: string): string[] {
  return words(s)
    .filter((w) => !STOP_WORDS.has(w))
    .map(stem);
}
