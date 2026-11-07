import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react';
import HymnsPanel from './HymnsPanel';
import type { Verse } from '../lib/bible';
import type { ChapterGeo, Place } from '../lib/geo';
import { journeysAtVerse, type Journey } from '../lib/journeys';
import { listsAtVerse, type StudyList } from '../lib/lists';
import { PERIODS, type Period } from '../data/periods';
import { NO_INLINE, NO_INLINE_NAMES, type PersonEntry } from '../lib/people';

interface Props {
  book: string;
  bookName: string;
  chapter: number;
  verses: Verse[] | null;
  loading: boolean;
  error: string | null;
  geo: ChapterGeo | null;
  selectedVerse: number | null;
  onSelectVerse: (v: number | null) => void;
  onSelectPlace: (verse: number, place: Place) => void;
  /** people named in each verse */
  people: Map<number, PersonEntry[]>;
  onSelectPerson: (verse: number, slug: string) => void;
  onFollowJourney: (journey: Journey, stopIndex: number) => void;
  activeJourneyId: string | null;
  activeList: { id: string; index: number } | null;
  onOpenListItem: (list: StudyList, index: number) => void;
  period: Period | null;
  onOpenPeriod: (id: string) => void;
  /** shown above the text (e.g. which part of a chapter, or why another version is shown) */
  before?: ReactNode;
  /** shown below the text (e.g. the translation's copyright notice) */
  after?: ReactNode;
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

type Part = string | { name: string; place: Place } | { name: string; person: PersonEntry };

/** Splits verse text so place and people names can be highlighted and tapped. */
function highlightNames(text: string, places: Place[], people: PersonEntry[]): Part[] {
  const byName = new Map<string, { place?: Place; person?: PersonEntry }>();
  for (const p of places) byName.set(p.name.toLowerCase(), { place: p });
  for (const p of people) {
    if (NO_INLINE.has(p.slug) || NO_INLINE_NAMES.has(p.name)) continue;
    const k = p.name.toLowerCase();
    if (!byName.has(k)) byName.set(k, { person: p }); // a place with the same name wins
  }
  if (!byName.size) return [text];
  const names = [...byName.keys()].sort((a, b) => b.length - a.length);
  const re = new RegExp(`\\b(${names.map(escapeRe).join('|')})\\b`, 'gi');
  const out: Part[] = [];
  let last = 0;
  for (const m of text.matchAll(re)) {
    const hit = byName.get(m[0].toLowerCase())!;
    if (m.index! > last) out.push(text.slice(last, m.index));
    out.push(hit.place ? { name: m[0], place: hit.place } : { name: m[0], person: hit.person! });
    last = m.index! + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export default function Reader({
  book,
  bookName,
  chapter,
  verses,
  loading,
  error,
  geo,
  selectedVerse,
  onSelectVerse,
  onSelectPlace,
  people: chapterPeople,
  onSelectPerson,
  onFollowJourney,
  activeJourneyId,
  activeList,
  onOpenListItem,
  period,
  onOpenPeriod,
  before,
  after,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hymnsOpen, setHymnsOpen] = useState(false);

  useEffect(() => setHymnsOpen(false), [book, chapter]);

  useEffect(() => {
    if (selectedVerse == null) return;
    const el = containerRef.current?.querySelector(`[data-verse="${selectedVerse}"]`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [selectedVerse, verses]);

  useEffect(() => {
    if (selectedVerse == null) containerRef.current?.scrollTo({ top: 0 });
  }, [book, chapter]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="reader" ref={containerRef}>
      <div className="chapter-head">
        <h1 className="chapter-title">
          {bookName} {chapter}
        </h1>
        <button className="hymns-btn" onClick={() => setHymnsOpen(true)} title="Hymns for this chapter">
          <span aria-hidden="true">♪</span> Hymns
        </button>
      </div>
      {hymnsOpen && (
        <HymnsPanel book={book} bookName={bookName} chapter={chapter} onClose={() => setHymnsOpen(false)} />
      )}
      {period && (
        <button
          className="period-badge"
          style={{ '--c': period.color } as React.CSSProperties}
          onClick={() => onOpenPeriod(period.id)}
          title="See this period of Bible history"
        >
          <span className="pb-num">{period.n}</span>
          Period {period.n} of {PERIODS.length}: <strong>{period.name}</strong>
          <span className="muted"> · {period.dates}</span>
        </button>
      )}
      {before}
      {loading && <p className="muted">Loading…</p>}
      {error && (
        <div className="error">
          <strong>Couldn’t load this chapter.</strong> {error}
          <div className="muted">Try another translation from the menu above.</div>
        </div>
      )}
      {!loading && !error && verses && (
        <div className="verses">
          {verses.map((v) => {
            const places = geo?.byVerse.get(v.verse) ?? [];
            const selected = selectedVerse === v.verse;
            const journeys = selected ? journeysAtVerse(book, chapter, v.verse) : [];
            const lists = selected ? listsAtVerse(book, chapter, v.verse) : [];
            return (
              <Fragment key={v.verse}>
                <p
                  data-verse={v.verse}
                  className={`verse${selected ? ' selected' : ''}${places.length ? ' has-places' : ''}`}
                  onClick={() => onSelectVerse(selected ? null : v.verse)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onSelectVerse(selected ? null : v.verse);
                    }
                  }}
                >
                  <sup className="vnum">{v.verse}</sup>
                  {highlightNames(v.text, places, chapterPeople.get(v.verse) ?? []).map((part, i) =>
                    typeof part === 'string' ? (
                      <Fragment key={i}>{part}</Fragment>
                    ) : 'person' in part ? (
                      <button
                        key={i}
                        className="person-name"
                        title={`About ${part.person.title}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectPerson(v.verse, part.person.slug);
                        }}
                      >
                        {part.name}
                      </button>
                    ) : (
                      <button
                        key={i}
                        className="place-name"
                        title={`Show ${part.place.name} on the map`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectPlace(v.verse, part.place);
                        }}
                      >
                        {part.name}
                      </button>
                    ),
                  )}
                  {places.length > 0 && (
                    <span className="pin" aria-label={`${places.length} place(s)`}>
                      ⌖
                    </span>
                  )}
                </p>
                {selected && lists.length > 0 && (
                  <div className="verse-journeys">
                    {lists.map(({ list, index }) => {
                      const on = activeList?.id === list.id && activeList.index === index;
                      return (
                        <button
                          key={list.id}
                          className="chip list-chip"
                          style={{ '--c': list.color } as React.CSSProperties}
                          onClick={() => onOpenListItem(list, index)}
                        >
                          {on ? '● ' : '☰ '}
                          {list.title}: {index + 1} of {list.items.length}
                        </button>
                      );
                    })}
                  </div>
                )}
                {selected && journeys.length > 0 && (
                  <div className="verse-journeys">
                    {journeys.map(({ journey, stopIndex }) => (
                      <button
                        key={journey.id}
                        className="chip"
                        style={{ '--c': journey.color } as React.CSSProperties}
                        onClick={() => onFollowJourney(journey, stopIndex)}
                      >
                        {activeJourneyId === journey.id ? '● ' : '➜ '}
                        {activeJourneyId === journey.id ? 'On' : 'Follow from'} stop {stopIndex + 1} of {journey.stops.length}:{' '}
                        {journey.title}
                      </button>
                    ))}
                  </div>
                )}
              </Fragment>
            );
          })}
        </div>
      )}
      {!loading && !error && verses && after}
    </div>
  );
}
