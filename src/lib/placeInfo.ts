import { getBook } from '../data/books';

export interface PlaceDetails {
  types: string[];
  /** spelling variants across translations */
  alt?: string[];
  /** other biblical names for the same place */
  aka?: string[];
  /** modern site candidates: [name, likelihood 0–100] */
  modern?: [string, number][];
  /** description when no modern site applies */
  site?: string;
  /** every verse naming the place, canonical order (OSIS) */
  refs: string[];
  wd?: string;
  factbook?: string;
  pleiades?: string;
  stories?: { t: string; ref: string }[];
}

export interface WikiInfo {
  title?: string;
  extract?: string;
  url?: string;
  thumbnail?: string;
  /** e.g. "c. 3000 BC" from Wikidata "inception" */
  established?: string;
}

const base = import.meta.env.BASE_URL;
let detailsPromise: Promise<PlaceDetails[]> | null = null;

export function loadPlaceDetails(): Promise<PlaceDetails[]> {
  detailsPromise ??= fetch(`${base}data/place-details.json`).then((r) => r.json());
  return detailsPromise;
}

/** "Acts.13.6" -> "Acts 13:6" */
export function formatOsis(ref: string): string {
  const [b, c, v] = ref.split('.');
  return `${getBook(b).name} ${c}:${v}`;
}

function formatWikidataTime(value: string, precision: number): string | undefined {
  const m = /^([+-]?)(\d+)-/.exec(value);
  if (!m) return undefined;
  const bc = m[1] === '-';
  const year = Number(m[2]);
  if (!year) return undefined;
  if (precision <= 6) {
    const mill = Math.ceil(year / 1000);
    return `${mill}${ordinal(mill)} millennium ${bc ? 'BC' : 'AD'}`;
  }
  if (precision === 7) {
    const cent = Math.ceil(year / 100);
    return `${cent}${ordinal(cent)} century ${bc ? 'BC' : 'AD'}`;
  }
  const approx = precision < 9 ? 'c. ' : '';
  return bc ? `${approx}${year} BC` : `${approx}AD ${year}`;
}

function ordinal(n: number) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}

const wikiCache = new Map<string, Promise<WikiInfo>>();

/** Looks up the English Wikipedia article and founding date for a Wikidata item. */
export function loadWikiInfo(wd: string): Promise<WikiInfo> {
  let p = wikiCache.get(wd);
  if (p) return p;
  p = (async () => {
    const key = `wiki:${wd}`;
    try {
      const cached = sessionStorage.getItem(key);
      if (cached) return JSON.parse(cached) as WikiInfo;
    } catch {
      /* ignore */
    }
    const query = `SELECT ?inception ?prec ?article WHERE {
      OPTIONAL { wd:${wd} p:P571/psv:P571 [ wikibase:timeValue ?inception; wikibase:timePrecision ?prec ] }
      OPTIONAL { ?article schema:about wd:${wd}; schema:isPartOf <https://en.wikipedia.org/> }
    } LIMIT 1`;
    const info: WikiInfo = {};
    const sparql = await fetch(
      `https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(query)}`,
      { headers: { Accept: 'application/sparql-results+json' } },
    ).then((r) => (r.ok ? r.json() : null));
    const row = sparql?.results?.bindings?.[0];
    if (row?.inception) info.established = formatWikidataTime(row.inception.value, Number(row.prec?.value ?? 9));
    const article: string | undefined = row?.article?.value;
    if (article) {
      const title = decodeURIComponent(article.split('/wiki/')[1] ?? '');
      const sum = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`).then(
        (r) => (r.ok ? r.json() : null),
      );
      if (sum) {
        info.title = sum.title;
        info.extract = sum.extract;
        info.url = sum.content_urls?.desktop?.page ?? article;
        info.thumbnail = sum.thumbnail?.source;
      } else {
        info.url = article;
      }
    }
    try {
      sessionStorage.setItem(key, JSON.stringify(info));
    } catch {
      /* ignore */
    }
    return info;
  })().catch(() => ({}));
  wikiCache.set(wd, p);
  return p;
}
