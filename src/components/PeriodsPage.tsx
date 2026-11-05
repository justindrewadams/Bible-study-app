import { useEffect, useRef } from 'react';
import { PERIODS, formatRange, type Period } from '../data/periods';
import { JOURNEYS } from '../lib/journeys';
import { formatOsis } from '../lib/placeInfo';

interface Props {
  /** period to scroll to */
  focusId: string | null;
  /** period containing the chapter being read */
  currentId: string | null;
  onRead: (book: string, chapter: number, verse?: number) => void;
  onFollowJourney: (journeyId: string) => void;
  onClose: () => void;
}

export default function PeriodsPage({ focusId, currentId, onRead, onFollowJourney, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = focusId ? ref.current?.querySelector(`#period-${focusId}`) : null;
    if (el) el.scrollIntoView({ block: 'start' });
    else ref.current?.scrollTo({ top: 0 });
  }, [focusId]);

  const jump = (id: string) =>
    ref.current?.querySelector(`#period-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  const goRef = (osis: string) => {
    const [b, c, v] = osis.split('.');
    onRead(b, Number(c), Number(v));
  };

  return (
    <div className="periods-page" ref={ref}>
      <div className="periods-inner">
        <div className="periods-head">
          <div>
            <h1>The 13 Periods of Bible History</h1>
            <p className="muted">
              Following Bob Waldron's outline of the Bible. Each period lists its story, key people and events, the
              scriptures that belong to it, and journeys you can follow on the map.
            </p>
          </div>
          <button className="btn" onClick={onClose}>
            ‹ Back to reading
          </button>
        </div>

        <nav className="timeline" aria-label="Periods timeline">
          {PERIODS.map((p) => (
            <button
              key={p.id}
              className={`tl-item${p.id === currentId ? ' current' : ''}`}
              style={{ '--c': p.color } as React.CSSProperties}
              onClick={() => jump(p.id)}
              title={`${p.name} (${p.dates})`}
            >
              <span className="tl-num">{p.n}</span>
              <span className="tl-name">{p.name}</span>
            </button>
          ))}
        </nav>

        {PERIODS.map((p) => (
          <PeriodSection
            key={p.id}
            period={p}
            current={p.id === currentId}
            onRead={onRead}
            onEvent={goRef}
            onFollowJourney={onFollowJourney}
          />
        ))}

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
}: {
  period: Period;
  current: boolean;
  onRead: Props['onRead'];
  onEvent: (osis: string) => void;
  onFollowJourney: (id: string) => void;
}) {
  const journeys = p.journeys.map((id) => JOURNEYS.find((j) => j.id === id)!).filter(Boolean);
  const first = p.passages[0];

  return (
    <section id={`period-${p.id}`} className="period" style={{ '--c': p.color } as React.CSSProperties}>
      <header className="period-head">
        <span className="period-num">{p.n}</span>
        <div>
          <h2>
            {p.name} {current && <span className="period-here">You're reading here</span>}
          </h2>
          <div className="period-dates">{p.dates}</div>
        </div>
      </header>

      <p className="period-summary">{p.summary}</p>

      <div className="period-grid">
        <div>
          <h3>Scripture</h3>
          <div className="period-chips">
            {p.passages.map((r) => (
              <button key={r.book + r.from} className="pchip" onClick={() => onRead(r.book, r.from)}>
                {formatRange(r)}
              </button>
            ))}
          </div>
          {p.note && <p className="muted small period-note">{p.note}</p>}
          <h3>Key people</h3>
          <p className="period-people">{p.people.join(' · ')}</p>
        </div>
        <div>
          <h3>Key events</h3>
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

      <div className="period-actions">
        <button className="btn primary" onClick={() => onRead(first.book, first.from)}>
          Start reading {formatRange({ ...first, to: first.from })}
        </button>
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
    </section>
  );
}
