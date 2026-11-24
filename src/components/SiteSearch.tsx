import { useEffect, useRef, useState, type ReactNode } from 'react';
import { formatOsis } from '../lib/placeInfo';
import { ESV_COPYRIGHT, fetchVerses, type Translation } from '../lib/bible';
import { getBook } from '../data/books';
import { findCandidates, loadVerseIndex, matchedWords, rankInTranslation, wantsVerses, type MatchKind, type VerseHit } from '../lib/verseSearch';
import { fold, words } from '../lib/stem';
import {
  formatShortRef,
  loadSearchIndex,
  search,
  snippet,
  type SearchResults,
} from '../lib/search';

export interface SearchActions {
  onGoTo: (book: string, chapter: number, verse: number | null) => void;
  onOpenPerson: (slug: string) => void;
  onOpenPlace: (index: number) => void;
  onFollowJourney: (id: string, stopIndex: number) => void;
  onOpenList: (id: string, index: number) => void;
  onOpenPeriod: (id: string) => void;
  onOpenNation: (id: string) => void;
}

interface Props extends SearchActions {
  /** the translation being read: verse results are shown (and judged) in it */
  translation: Translation;
  esvKey?: string;
}

const KIND_LABEL: Record<MatchKind, string> = {
  phrase: 'Exact phrase',
  all: 'All your words',
  most: 'Most of your words',
  meaning: 'Same Hebrew/Greek words',
};

/** Verse text with the searched phrase, or failing that the searched words, in bold. */
function VerseText({ text, query }: { text: string; query: string }) {
  // the whole phrase, when it's there ("all have sinned"); "Yahweh" stands in for "LORD" at the same length
  const qw = words(query);
  if (qw.length >= 2) {
    const re = new RegExp(`\\b${qw.map((w) => w.replace(/[^a-z0-9]/g, '')).join('[^A-Za-z0-9]+')}\\b`, 'i');
    const m = re.exec(fold(text).replace(/\byahweh\b|\bjehovah\b/g, (x) => 'lord'.padEnd(x.length, '\u0000')));
    if (m) {
      return (
        <>
          {text.slice(0, m.index)}
          <strong>{text.slice(m.index, m.index + m[0].length)}</strong>
          {text.slice(m.index + m[0].length)}
        </>
      );
    }
  }
  const bold = matchedWords(query, text);
  return (
    <>
      {text.split(/([A-Za-z\u00C0-\u024F’']+)/).map((part, i) =>
        i % 2 && bold.has(fold(part).replace(/'s$/, '')) ? <strong key={i}>{part}</strong> : part,
      )}
    </>
  );
}

type VerseState = { query: string; translation: string; loading: boolean; hits: (VerseHit & { web: boolean })[] };

const MagnifierIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.6">
    <circle cx="10" cy="10" r="6.5" />
    <path d="M15 15 21 21" strokeLinecap="square" />
  </svg>
);

/** Text with the searched word in bold. */
function Snip({ text, query, width }: { text?: string; query: string; width?: number }) {
  if (!text) return null;
  const s = snippet(text, query, width);
  return (
    <>
      {s.before}
      {s.match && <strong>{s.match}</strong>}
      {s.after}
    </>
  );
}

function Section({
  title,
  count,
  initial = 5,
  children,
}: {
  title: string;
  count: number;
  initial?: number;
  children: (limit: number) => ReactNode;
}) {
  const [all, setAll] = useState(false);
  if (!count) return null;
  return (
    <section className="search-section">
      <h3>
        {title} <span className="search-count">{count}</span>
      </h3>
      <ul>{children(all ? count : initial)}</ul>
      {count > initial && (
        <button className="search-more" onClick={() => setAll(!all)}>
          {all ? 'Show fewer' : `Show all ${count}`}
        </button>
      )}
    </section>
  );
}

function Row({ title, sub, text, onClick }: { title: ReactNode; sub?: ReactNode; text?: ReactNode; onClick: () => void }) {
  return (
    <li>
      <button className="search-row" onClick={onClick}>
        <span className="search-row-title">{title}</span>
        {sub && <span className="search-row-sub">{sub}</span>}
        {text && <span className="search-row-text">{text}</span>}
      </button>
    </li>
  );
}

/**
 * Search box for the header: a text box when the header has room, otherwise a magnifying glass that opens one.
 * Results come from the app's own data, plus verses whose wording matches (lib/verseSearch.ts): found with the
 * public-domain WEB and the Hebrew/Greek word index, then shown in the reader's translation (the 3 best).
 */
export default function SiteSearch(props: Props) {
  const { translation, esvKey } = props;
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  /** the magnifying-glass version: the box is showing */
  const [expanded, setExpanded] = useState(false);
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const q = query.trim();
  useEffect(() => {
    if (q.length < 2) {
      setResults(null);
      return;
    }
    let live = true;
    setLoading(true);
    const t = setTimeout(() => {
      loadSearchIndex()
        .then((idx) => live && setResults(search(idx, q)))
        .catch(() => live && setResults(null))
        .finally(() => live && setLoading(false));
    }, 120);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [q]);

  // verses whose wording matches: slower (data loads on first use, and the reader's translation is fetched)
  const [verses, setVerses] = useState<VerseState | null>(null);
  useEffect(() => {
    if (!wantsVerses(q)) {
      setVerses(null);
      return;
    }
    let live = true;
    setVerses((v) => ({ query: q, translation: translation.id, loading: true, hits: v?.query === q ? v.hits : [] }));
    const t = setTimeout(async () => {
      try {
        const idx = await loadVerseIndex();
        const cands = findCandidates(idx, q, 6);
        const ref = (c: { book: string; chapter: number; verse: number }) => `${c.book}.${c.chapter}.${c.verse}`;
        let texts = new Map<string, string>();
        // the WEB is already on the device; other translations are fetched (one request for the ESV)
        if (translation.id !== 'bibleapi:web' && cands.length)
          texts = await fetchVerses(translation, cands.map(ref), { esvKey }).catch(() => new Map<string, string>());
        const byId = new Map<number, string>();
        for (const c of cands) {
          const tx = translation.id === 'bibleapi:web' ? c.web : texts.get(ref(c));
          if (tx) byId.set(c.id, tx);
        }
        const hits = rankInTranslation(idx, q, cands, byId, 3).map((h) => ({
          ...h,
          web: translation.id !== 'bibleapi:web' && !texts.has(ref(h)),
        }));
        if (live) setVerses({ query: q, translation: translation.id, loading: false, hits });
      } catch {
        if (live) setVerses({ query: q, translation: translation.id, loading: false, hits: [] });
      }
    }, 450);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [q, translation, esvKey]);

  // a new search starts at the top of the results
  useEffect(() => {
    panelRef.current?.scrollTo({ top: 0 });
  }, [results]);

  const close = () => {
    setOpen(false);
    setExpanded(false);
    inputRef.current?.blur();
  };

  useEffect(() => {
    if (!open && !expanded) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, expanded]);

  /** run an action, then put the results away */
  const pick = (fn: () => void) => () => {
    fn();
    close();
  };

  const r = results;
  const total = r
    ? r.refs.length + r.people.length + r.places.length + r.journeys.length + r.lists.length + r.periods.length + r.nations.length + r.hymns.length
    : 0;
  const showPanel = open && q.length >= 2;
  const verseHits = verses && verses.query === q ? verses.hits : [];
  const versesLoading = !!verses && verses.query === q && verses.loading;
  const anyEsv = verseHits.some((h) => !h.web) && translation.provider === 'esv';
  const sameName = new Set(
    (r?.places ?? []).map((x) => x.place.name).filter((name, i, all) => all.indexOf(name) !== i),
  );

  return (
    <div className={`site-search${expanded ? ' expanded' : ''}${showPanel ? ' has-results' : ''}`}>
      <button
        className="search-toggle"
        aria-label="Search"
        aria-expanded={expanded}
        onClick={() => {
          if (expanded) close();
          else {
            setExpanded(true);
            setOpen(true);
            loadSearchIndex();
            // focus once the box is showing (on phones this also brings up the keyboard)
            setTimeout(() => inputRef.current?.focus(), 0);
          }
        }}
      >
        {expanded ? <span aria-hidden="true">✕</span> : <MagnifierIcon />}
      </button>
      <div className="ss-box">
        <span className="ss-box-icon">
          <MagnifierIcon />
        </span>
        <input
          ref={inputRef}
          type="search"
          value={query}
          placeholder="Search people, places, verses…"
          aria-label="Search the app"
          enterKeyHint="search"
          autoComplete="off"
          spellCheck={false}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => {
            setOpen(true);
            loadSearchIndex();
          }}
          onClick={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              // Enter opens the first result
              panelRef.current?.querySelector<HTMLButtonElement>('.search-row')?.click();
            } else if (e.key === 'ArrowDown') {
              e.preventDefault();
              panelRef.current?.querySelector<HTMLButtonElement>('.search-row')?.focus();
            }
          }}
        />
      </div>

      {(showPanel || expanded) && <div className="search-scrim" onClick={close} />}
      {showPanel && (
        <div
          className="search-panel"
          ref={panelRef}
          role="region"
          aria-label="Search results"
          onKeyDown={(e) => {
            if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
            const rows = [...(panelRef.current?.querySelectorAll<HTMLButtonElement>('.search-row') ?? [])];
            const i = rows.indexOf(document.activeElement as HTMLButtonElement);
            e.preventDefault();
            if (e.key === 'ArrowUp' && i <= 0) inputRef.current?.focus();
            else rows[Math.max(0, Math.min(rows.length - 1, i + (e.key === 'ArrowDown' ? 1 : -1)))]?.focus();
          }}
        >
          {!r || r.query.trim() !== q ? (
            <p className="search-empty">{loading ? 'Searching…' : ''}</p>
          ) : total === 0 && !verseHits.length && !versesLoading ? (
            <p className="search-empty">
              Nothing found for “{q}”. Try a name, a place, or a reference like <em>John 3:16</em>.
            </p>
          ) : (
            <div key={r.query}>
              <Section title="Go to" count={r.refs.length}>
                {(n) =>
                  r.refs.slice(0, n).map((x) => (
                    <Row
                      key={x.label}
                      title={x.label}
                      sub="Open in the reader"
                      onClick={pick(() => props.onGoTo(x.book.osis, x.chapter, x.verse))}
                    />
                  ))
                }
              </Section>

              {(verseHits.length > 0 || versesLoading) && (
                <section className="search-section verse-results">
                  <h3>
                    Verses {verseHits.length > 0 && <span className="search-count">{verseHits.length}</span>}
                  </h3>
                  {versesLoading && !verseHits.length ? (
                    <p className="search-empty">Searching the Bible…</p>
                  ) : (
                    <ul>
                      {verseHits.map((h) => (
                        <Row
                          key={`${h.book}.${h.chapter}.${h.verse}`}
                          title={`${h.book === 'Ps' ? 'Psalm' : getBook(h.book).name} ${h.chapter}:${h.verse}`}
                          sub={`${KIND_LABEL[h.kind]} · ${h.web ? 'WEB' : translation.code.toUpperCase()}`}
                          text={<VerseText text={h.text} query={q} />}
                          onClick={pick(() => props.onGoTo(h.book, h.chapter, h.verse))}
                        />
                      ))}
                    </ul>
                  )}
                  {anyEsv && <p className="verse-results-notice">{ESV_COPYRIGHT}</p>}
                </section>
              )}

              <Section title="People" count={r.people.length}>
                {(n) =>
                  r.people.slice(0, n).map(({ person: p, note }) => (
                    <Row
                      key={p.slug}
                      title={p.title}
                      sub={[note, `${p.count} ${p.count === 1 ? 'verse' : 'verses'}`, `first in ${formatOsis(p.firstRef)}`]
                        .filter(Boolean)
                        .join(' · ')}
                      onClick={pick(() => props.onOpenPerson(p.slug))}
                    />
                  ))
                }
              </Section>

              <Section title="Places" count={r.places.length} initial={6}>
                {(n) =>
                  r.places.slice(0, n).map(({ place: p, modern, note, text }) => (
                    <Row
                      key={p.index}
                      title={p.name}
                      // the likely modern site tells apart places with the same name (the two Antiochs)
                      sub={[note ?? p.type, sameName.has(p.name) && modern && modern !== p.name && `today ${modern}`]
                        .filter(Boolean)
                        .join(' · ')}
                      text={text && <Snip text={text} query={q} />}
                      onClick={pick(() => props.onOpenPlace(p.index))}
                    />
                  ))
                }
              </Section>

              <Section title="Journeys" count={r.journeys.length}>
                {(n) =>
                  r.journeys.slice(0, n).map(({ journey: j, stopIndex, text }) => (
                    <Row
                      key={j.id}
                      title={j.title}
                      sub={`${j.era} · ${j.stops.length} stops${stopIndex ? ` · starts at stop ${stopIndex + 1}` : ''}`}
                      text={<Snip text={text} query={q} />}
                      onClick={pick(() => props.onFollowJourney(j.id, stopIndex))}
                    />
                  ))
                }
              </Section>

              <Section title="Study lists" count={r.lists.length}>
                {(n) =>
                  r.lists.slice(0, n).map(({ list: l, index, item, text }) => (
                    <Row
                      key={`${l.id}-${item ? index : 'all'}`}
                      title={item ? <Snip text={item} query={q} width={200} /> : l.title}
                      sub={item ? `${l.title} · ${index + 1} of ${l.items.length}` : `${l.group} · ${l.items.length} items`}
                      text={<Snip text={text} query={q} />}
                      onClick={pick(() => props.onOpenList(l.id, index))}
                    />
                  ))
                }
              </Section>

              <Section title="Periods" count={r.periods.length} initial={3}>
                {(n) =>
                  r.periods.slice(0, n).map(({ period: p, text }) => (
                    <Row
                      key={p.id}
                      title={`${p.n}. ${p.name}`}
                      sub={p.dates}
                      text={<Snip text={text} query={q} />}
                      onClick={pick(() => props.onOpenPeriod(p.id))}
                    />
                  ))
                }
              </Section>

              <Section title="Nations" count={r.nations.length} initial={3}>
                {(n) =>
                  r.nations.slice(0, n).map(({ nation: x, text }) => (
                    <Row
                      key={x.id}
                      title={x.name}
                      text={<Snip text={text} query={q} />}
                      onClick={pick(() => props.onOpenNation(x.id))}
                    />
                  ))
                }
              </Section>

              <Section title="Hymns" count={r.hymns.length} initial={3}>
                {(n) =>
                  r.hymns.slice(0, n).map(({ hymn: h }) => {
                    const ref = h.from?.[0] ?? h.fits?.[0];
                    return (
                      <Row
                        key={h.title}
                        title={<Snip text={h.title} query={q} width={200} />}
                        sub={[h.by, h.year].filter(Boolean).join(', ')}
                        text={ref ? `${h.from?.length ? 'Written from' : 'Fits'} ${formatShortRef(ref)}` : undefined}
                        onClick={pick(() => {
                          if (!ref) return;
                          const [b, c] = ref.split('.');
                          props.onGoTo(b, Number(c), null);
                        })}
                      />
                    );
                  })
                }
              </Section>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
