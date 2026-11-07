import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { FAMILY_INFO, NATIONS, type Family, type Nation } from '../data/nations';
import { loadPeople, type PersonEntry } from '../lib/people';
import { formatOsis } from '../lib/placeInfo';

interface Props {
  /** nation to scroll to */
  focusId: string | null;
  onOpenPerson: (slug: string) => void;
  onShowOnMap: (nation: Nation) => void;
  onRead: (book: string, chapter: number, verse: number) => void;
  onClose: () => void;
}

type FamilyFilter = 'all' | Family | 'abraham';

const FAMILIES: Family[] = ['Shem', 'Ham', 'Japheth', 'Unknown'];

function matches(n: Nation, q: string) {
  if (!q) return true;
  const hay = [n.name, ...(n.aka ?? []), n.region, n.origin, ...n.history, ...n.refs.map((r) => r.t)]
    .join(' ')
    .toLowerCase();
  return q
    .toLowerCase()
    .split(/\s+/)
    .every((w) => hay.includes(w));
}

export default function NationsPage({ focusId, onOpenPerson, onShowOnMap, onRead, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState('');
  const [family, setFamily] = useState<FamilyFilter>('all');
  const [people, setPeople] = useState<Map<string, PersonEntry>>(new Map());

  useEffect(() => {
    loadPeople().then(({ bySlug }) => setPeople(bySlug));
  }, []);

  const shown = useMemo(
    () =>
      NATIONS.filter(
        (n) =>
          (family === 'all' || (family === 'abraham' ? n.abraham : n.family === family)) && matches(n, query.trim()),
      ),
    [query, family],
  );
  const filtering = query.trim() !== '' || family !== 'all';

  useEffect(() => {
    const el = focusId ? ref.current?.querySelector(`#nation-${focusId}`) : null;
    if (el) el.scrollIntoView({ block: 'start' });
    else ref.current?.scrollTo({ top: 0 });
  }, [focusId]);

  const jump = (id: string) => {
    if (!shown.some((n) => n.id === id)) {
      setQuery('');
      setFamily('all');
    }
    requestAnimationFrame(() =>
      ref.current?.querySelector(`#nation-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
    );
  };

  const personName = (slug: string) => people.get(slug)?.name ?? slug.replace(/_\d+$/, '').replace(/^\w/, (c) => c.toUpperCase());

  return (
    <div className="periods-page nations-page" ref={ref}>
      <div className="periods-bar">
        <button className="bar-back" onClick={onClose}>
          ‹ Back to reading
        </button>
        <span className="bar-title">Nations of the Bible</span>
      </div>

      <section className="hero people-hero nations-hero">
        <div className="hero-text">
          <h1>Nations of the Bible</h1>
          <p>
            {NATIONS.length} nations and peoples from Scripture: where they lived, where they came from, and how their
            story meets Israel’s.{' '}
            <span className="hero-more">
              Origins follow the Table of Nations in Genesis 10. Tap a name in a family line to open that person.
            </span>
          </p>
        </div>
      </section>

      <div className="periods-inner">
        <div className="filter-bar" role="search">
          <label className="search-box">
            <input
              type="search"
              placeholder="Search nations, places, events…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search nations"
            />
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
              <circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" strokeWidth="2.2" />
              <path d="M15.5 15.5 21 21" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
            </svg>
          </label>
          <span className="filter-label">Filter</span>
          <select value={family} onChange={(e) => setFamily(e.target.value as FamilyFilter)} aria-label="Family line">
            <option value="all">All nations</option>
            <option value="Shem">Line of Shem</option>
            <option value="abraham">Abraham’s family</option>
            <option value="Ham">Line of Ham</option>
            <option value="Japheth">Line of Japheth</option>
            <option value="Unknown">Origin not given</option>
          </select>
          <button
            className="clear-link"
            disabled={!filtering}
            onClick={() => {
              setQuery('');
              setFamily('all');
            }}
          >
            Clear
          </button>
        </div>

        <nav className="nation-index" aria-label="Jump to a nation">
          {FAMILIES.map((f) => (
            <div key={f} className="ni-group" style={{ '--c': FAMILY_INFO[f].color } as React.CSSProperties}>
              <span className="ni-label">{FAMILY_INFO[f].label}</span>
              {NATIONS.filter((n) => n.family === f).map((n) => (
                <button key={n.id} className={`ni-item${shown.includes(n) ? '' : ' dimmed'}`} onClick={() => jump(n.id)}>
                  {n.name}
                </button>
              ))}
            </div>
          ))}
        </nav>

        {filtering && (
          <p className="result-count">
            Showing {shown.length} of {NATIONS.length} nations
          </p>
        )}

        <div className="period-list">
          {shown.map((n) => (
            <NationSection
              key={n.id}
              nation={n}
              personName={personName}
              onOpenPerson={onOpenPerson}
              onShowOnMap={onShowOnMap}
              onRead={onRead}
            />
          ))}
          {shown.length === 0 && <p className="muted">No nations match your search.</p>}
        </div>

        <p className="muted small periods-foot">
          Summaries are written for this app. Where a nation’s ancestry isn’t stated in Scripture, it says so. Map pins
          mark the heart of each homeland; borders shifted over the centuries.
        </p>
      </div>
    </div>
  );
}

function NationSection({
  nation: n,
  personName,
  onOpenPerson,
  onShowOnMap,
  onRead,
}: {
  nation: Nation;
  personName: (slug: string) => string;
  onOpenPerson: Props['onOpenPerson'];
  onShowOnMap: Props['onShowOnMap'];
  onRead: Props['onRead'];
}) {
  const info = FAMILY_INFO[n.family];
  const goRef = (osis: string) => {
    const [b, c, v] = osis.split('.');
    onRead(b, Number(c), Number(v));
  };

  return (
    <section id={`nation-${n.id}`} className="period nation" style={{ '--c': info.color } as React.CSSProperties}>
      <header className="period-head">
        <div className="period-title">
          <h2>{n.name}</h2>
          {n.aka && <div className="period-dates">Also: {n.aka.join(', ')}</div>}
        </div>
        <span className="nation-family">
          {info.label}
          {n.abraham && <> · Abraham’s family</>}
        </span>
      </header>

      <div className="period-body">
        <div className="period-grid">
          <div>
            <h3>Where</h3>
            <p className="nation-text">{n.region}</p>
            <button className="pchip nation-map" onClick={() => onShowOnMap(n)}>
              ⌖ Show on map
            </button>

            <h3>Origin</h3>
            <p className="nation-text">{n.origin}</p>
            {n.line && (
              <div className="nation-line" aria-label="Family line">
                {n.line.map((slug, i) => (
                  <Fragment key={slug}>
                    {i > 0 && <span className="nl-arrow">›</span>}
                    <button
                      className={`pchip nl-person${i === n.line!.length - 1 ? ' founder' : ''}`}
                      onClick={() => onOpenPerson(slug)}
                      title={`Open ${personName(slug)}`}
                    >
                      {personName(slug)}
                    </button>
                  </Fragment>
                ))}
              </div>
            )}
            {n.related && (
              <ul className="nation-related">
                {n.related.map((r) => (
                  <li key={r.slug}>
                    <button className="link" onClick={() => onOpenPerson(r.slug)}>
                      {personName(r.slug)}
                    </button>{' '}
                    <span className="muted">· {r.note}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <h3>History</h3>
            {n.history.map((p, i) => (
              <p key={i} className="nation-text">
                {p}
              </p>
            ))}
            <h3>Key verses</h3>
            <ul className="period-events">
              {n.refs.map((r) => (
                <li key={r.ref}>
                  <button onClick={() => goRef(r.ref)}>
                    <span>{r.t}</span>
                    <span className="pc-ref">{formatOsis(r.ref)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
