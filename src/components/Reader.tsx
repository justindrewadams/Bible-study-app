import { Fragment, useEffect, useRef } from 'react';
import type { Verse } from '../lib/bible';
import type { ChapterGeo, Place } from '../lib/geo';
import { journeysAtVerse, type Journey } from '../lib/journeys';
import { PERIODS, type Period } from '../data/periods';

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
  onFollowJourney: (journey: Journey, stopIndex: number) => void;
  activeJourneyId: string | null;
  period: Period | null;
  onOpenPeriod: (id: string) => void;
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Splits verse text so place names can be highlighted and tapped. */
function highlightPlaces(text: string, places: Place[]) {
  if (!places.length) return [text];
  const names = [...new Set(places.map((p) => p.name))].sort((a, b) => b.length - a.length);
  const re = new RegExp(`\\b(${names.map(escapeRe).join('|')})\\b`, 'gi');
  const out: (string | { name: string; place: Place })[] = [];
  let last = 0;
  for (const m of text.matchAll(re)) {
    const place = places.find((p) => p.name.toLowerCase() === m[0].toLowerCase())!;
    if (m.index! > last) out.push(text.slice(last, m.index));
    out.push({ name: m[0], place });
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
  onFollowJourney,
  activeJourneyId,
  period,
  onOpenPeriod,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

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
      <h1 className="chapter-title">
        {bookName} {chapter}
      </h1>
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
                  {highlightPlaces(v.text, places).map((part, i) =>
                    typeof part === 'string' ? (
                      <Fragment key={i}>{part}</Fragment>
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
    </div>
  );
}
