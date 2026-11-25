import { useEffect, useMemo, useRef, useState } from 'react';
import { PERIODS, formatRange, type Period } from '../data/periods';
import { getBook } from '../data/books';
import { JOURNEYS } from '../lib/journeys';
import { LISTS } from '../lib/lists';
import { formatOsis } from '../lib/placeInfo';

interface Props {
  /** period to scroll to */
  focusId: string | null;
  /** period containing the chapter being read */
  currentId: string | null;
  onRead: (book: string, chapter: number, verse?: number) => void;
  onFollowJourney: (journeyId: string) => void;
  onOpenList: (listId: string) => void;
  onClose: () => void;
}

type Era = 'all' | 'OT' | 'between' | 'NT';

const eraOf = (p: Period): Exclude<Era, 'all'> =>
  p.between ? 'between' : getBook(p.passages[0].book).testament === 'OT' ? 'OT' : 'NT';

function matches(p: Period, q: string) {
  if (!q) return true;
  const hay = [
    p.name,
    p.summary,
    p.dates,
    ...p.people,
    ...p.events.map((e) => e.t),
    ...p.passages.map(formatRange),
  ]
    .join(' ')
    .toLowerCase();
  return q
    .toLowerCase()
    .split(/\s+/)
    .every((w) => hay.includes(w));
}

export default function PeriodsPage({ focusId, currentId, onRead, onFollowJourney, onOpenList, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState('');
  const [era, setEra] = useState<Era>('all');

  const shown = useMemo(
    () => PERIODS.filter((p) => (era === 'all' || eraOf(p) === era) && matches(p, query.trim())),
    [query, era],
  );
  const filtering = query.trim() !== '' || era !== 'all';

  useEffect(() => {
    const el = focusId ? ref.current?.querySelector(`#period-${focusId}`) : null;
    if (el) el.scrollIntoView({ block: 'start' });
    else ref.current?.scrollTo({ top: 0 });
  }, [focusId]);

  const jump = (id: string) => {
    if (!shown.some((p) => p.id === id)) {
      setQuery('');
      setEra('all');
    }
    requestAnimationFrame(() =>
      ref.current?.querySelector(`#period-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
    );
  };

  const goRef = (osis: string) => {
    const [b, c, v] = osis.split('.');
    onRead(b, Number(c), Number(v));
  };

  return (
    <div className="periods-page" ref={ref}>
      {/* stays pinned to the top while scrolling */}
      <div className="periods-bar">
        <button className="bar-back" onClick={onClose}>
          ‹ Back to reading
        </button>
        <span className="bar-title">Periods of Bible History</span>
      </div>
      <section className="hero people-hero periods-hero">
        <div className="hero-text">
          <h1>Periods of Bible History</h1>
          <p>
            From Creation to the letters to Christians, the Bible's story unfolds in Bob and Sandra Waldron's{' '}
            {PERIODS.length} periods.{' '}
            <span className="hero-more">
              Each one gives a short summary, the people and events to know, the scriptures that belong to it, and
              journeys to follow on the map.
            </span>
          </p>
        </div>
      </section>

      <div className="periods-inner">
        <div className="filter-bar" role="search">
          <label className="search-box">
            <input
              type="search"
              placeholder="Search periods, people, events…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search periods"
            />
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
              <circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" strokeWidth="2.2" />
              <path d="M15.5 15.5 21 21" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
            </svg>
          </label>
          <span className="filter-label">Filter</span>
          <select value={era} onChange={(e) => setEra(e.target.value as Era)} aria-label="Testament">
            <option value="all">All periods</option>
            <option value="OT">Old Testament</option>
            <option value="between">Between the Testaments</option>
            <option value="NT">New Testament</option>
          </select>
          <button
            className="clear-link"
            onClick={() => {
              setQuery('');
              setEra('all');
            }}
            disabled={!filtering}
          >
            Clear
          </button>
        </div>

        <nav className="timeline" aria-label="Periods timeline">
          {PERIODS.map((p) => (
            <button
              key={p.id}
              className={`tl-item${p.id === currentId ? ' current' : ''}${
                shown.includes(p) ? '' : ' dimmed'
              }${p.between ? ' between' : ''}`}
              style={{ '--c': p.color } as React.CSSProperties}
              onClick={() => jump(p.id)}
              title={`${p.name} (${p.dates})`}
            >
              <span className="tl-num">{p.n}</span>
              <span className="tl-name">{p.name}</span>
            </button>
          ))}
        </nav>

        {filtering && (
          <p className="result-count">
            Showing {shown.length} of {PERIODS.length} periods
          </p>
        )}

        <div className="period-list">
          {shown.map((p) => (
            <PeriodSection
              key={p.id}
              period={p}
              current={p.id === currentId}
              onRead={onRead}
              onEvent={goRef}
              onFollowJourney={onFollowJourney}
              onOpenList={onOpenList}
            />
          ))}
          {shown.length === 0 && <p className="muted">No periods match your search.</p>}
        </div>

        <p className="muted small periods-foot">
          Period boundaries for books that span more than one era, and the placement of Job, the prophets and the
          psalms, follow common conservative datings. Dates are approximate.
        </p>
      </div>
    </div>
  );
}

function PeriodSection({
  period: p,
  current,
  onRead,
  onEvent,
  onFollowJourney,
  onOpenList,
}: {
  period: Period;
  current: boolean;
  onRead: Props['onRead'];
  onEvent: (osis: string) => void;
  onFollowJourney: (id: string) => void;
  onOpenList: (id: string) => void;
}) {
  const journeys = p.journeys.map((id) => JOURNEYS.find((j) => j.id === id)!).filter(Boolean);
  const lists = (p.lists ?? []).map((id) => LISTS.find((l) => l.id === id)!).filter(Boolean);
  const first = p.passages[0];

  return (
    <section id={`period-${p.id}`} className="period" style={{ '--c': p.color } as React.CSSProperties}>
      <header className="period-head">
        <span className="period-num">{p.n}</span>
        <div className="period-title">
          <h2>{p.name}</h2>
          <div className="period-dates">{p.dates}</div>
        </div>
        {current && <span className="period-here">You're reading here</span>}
      </header>

      <div className="period-body">
        <p className="period-summary">{p.summary}</p>

        <div className="period-grid">
          <div>
            <h3>Scripture</h3>
            {p.passages.length ? (
              <div className="period-chips">
                {p.passages.map((r) => (
                  <button key={r.book + r.from} className="pchip" onClick={() => onRead(r.book, r.from)}>
                    {formatRange(r)}
                  </button>
                ))}
              </div>
            ) : (
              <p className="period-people">None written. This is the gap between Malachi and Matthew.</p>
            )}
            {p.note && <p className="muted small period-note">{p.note}</p>}
            <h3>Key people</h3>
            <p className="period-people">{p.people.join(' · ')}</p>
          </div>
          <div>
            <h3>{p.between ? 'In prophecy & looking back' : 'Key events'}</h3>
            <ul className="period-events">
              {p.events.map((e) => (
                <li key={e.ref}>
                  <button onClick={() => onEvent(e.ref)}>
                    <span>{e.t}</span>
                    <span className="pc-ref">{formatOsis(e.ref)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {lists.length > 0 && (
          <div className="period-lists">
            <h3>Lists to study</h3>
            <div className="period-chips">
              {lists.map((l) => (
                <button
                  key={l.id}
                  className="pchip list-pchip"
                  style={{ '--lc': l.color } as React.CSSProperties}
                  onClick={() => onOpenList(l.id)}
                >
                  ☰ {l.title} <span className="muted">({l.items.length})</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {(first || journeys.length > 0) && (
          <div className="period-actions">
            {first && (
              <button className="btn primary" onClick={() => onRead(first.book, first.from)}>
                Start reading {formatRange({ ...first, to: first.from })}
              </button>
            )}
            {journeys.map((j) => (
              <button
                key={j.id}
                className="chip"
                style={{ '--c': j.color } as React.CSSProperties}
                onClick={() => onFollowJourney(j.id)}
              >
                ➜ {j.title}
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

