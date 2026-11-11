import { useEffect, useMemo, useRef, useState } from 'react';
import { loadPlaces, type Place } from '../lib/geo';
import { loadPlaceDetails } from '../lib/placeInfo';
import { formatDistance, milesBetween, walkingTime } from '../lib/distance';
import { loadRoads, routeBetween, type NoRoute, type RoadRoute } from '../lib/roads';
import { norm } from '../lib/search';

export interface Measure {
  a: Place | null;
  b: Place | null;
}

/** The road route between the two measured places: still loading, found, or why there is none. */
export type RoadResult = { state: 'loading' } | { state: 'found'; route: RoadRoute } | { state: 'none'; why: NoRoute | 'error' };

export function useRoadRoute(measure: Measure | null): RoadResult | null {
  const a = measure?.a ?? null;
  const b = measure?.b ?? null;
  const [result, setResult] = useState<RoadResult | null>(null);
  useEffect(() => {
    if (!a || !b) {
      setResult(null);
      return;
    }
    let live = true;
    setResult({ state: 'loading' });
    loadRoads()
      .then((g) => {
        if (!live) return;
        const r = routeBetween(g, a, b);
        setResult('none' in r ? { state: 'none', why: r } : { state: 'found', route: r });
      })
      .catch(() => live && setResult({ state: 'none', why: 'error' }));
    return () => {
      live = false;
    };
  }, [a, b]);
  return result;
}

/** Usually a sea voyage: the road way round is far longer than the straight line. */
const LIKELY_BY_SEA = (road: number, straight: number) => straight > 150 && road > straight * 1.5;

interface Props {
  measure: Measure;
  road: RoadResult | null;
  onChange: (m: Measure) => void;
  onClose: () => void;
}

interface Option {
  place: Place;
  n: string;
  modern?: string;
}

let optionsPromise: Promise<Option[]> | null = null;
function loadOptions() {
  optionsPromise ??= Promise.all([loadPlaces(), loadPlaceDetails()]).then(([places, details]) =>
    places.map((place) => ({ place, n: norm(place.name), modern: details[place.index]?.modern?.[0]?.[0] })),
  );
  return optionsPromise;
}

/** A place slot: shows the chosen place, or a box to type one. */
function PlacePicker({
  label,
  value,
  onPick,
  autoFocus,
}: {
  label: string;
  value: Place | null;
  onPick: (p: Place | null) => void;
  autoFocus?: boolean;
}) {
  const [query, setQuery] = useState('');
  const [options, setOptions] = useState<Option[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadOptions().then(setOptions);
  }, []);
  useEffect(() => {
    // not on phones, where the keyboard would cover the map people may want to tap
    if (autoFocus && !value && !window.matchMedia('(max-width: 860px)').matches) inputRef.current?.focus({ preventScroll: true });
  }, [autoFocus, value]);

  const matches = useMemo(() => {
    const q = norm(query.trim());
    if (q.length < 2) return [];
    const starts = options.filter((o) => o.n.startsWith(q));
    const inside = options.filter((o) => !o.n.startsWith(q) && o.n.includes(q));
    const list = [...starts, ...inside].slice(0, 6);
    // places that share a name are told apart by today's site
    const dupes = new Set(list.map((o) => o.place.name).filter((n, i, all) => all.indexOf(n) !== i));
    return list.map((o) => ({ ...o, dupe: dupes.has(o.place.name) }));
  }, [query, options]);

  if (value) {
    return (
      <div className="dp-slot">
        <span className="dp-label">{label}</span>
        <span className="dp-chosen">{value.name}</span>
        <button className="dp-clear" onClick={() => onPick(null)} aria-label={`Change ${label.toLowerCase()} place`}>
          ✕
        </button>
      </div>
    );
  }

  return (
    <div className="dp-slot dp-empty">
      <span className="dp-label">{label}</span>
      <input
        ref={inputRef}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && matches[0]) {
            onPick(matches[0].place);
            setQuery('');
          }
        }}
        placeholder="Type a place, or tap one on the map"
        aria-label={`${label} place`}
        autoComplete="off"
        spellCheck={false}
      />
      {matches.length > 0 && (
        <ul className="dp-options">
          {matches.map((o) => (
            <li key={o.place.index}>
              <button
                onClick={() => {
                  onPick(o.place);
                  setQuery('');
                }}
              >
                <strong>{o.place.name}</strong>
                <span className="muted">
                  {' '}
                  · {o.place.type}
                  {o.dupe && o.modern && o.modern !== o.place.name ? ` · today ${o.modern}` : ''}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function RoadLine({ road, straight, a, b }: { road: RoadResult | null; straight: number; a: Place; b: Place }) {
  if (!road || road.state === 'loading')
    return (
      <div className="dp-road">
        <span className="dp-row-label">By road</span>
        <span className="muted">Finding the road route…</span>
      </div>
    );
  if (road.state === 'none') {
    const why = road.why;
    const text =
      why === 'error'
        ? 'The road map could not be loaded. Please try again in a little while.'
        : why.none === 'unconnected'
          ? 'No road joins these places: the way between them crosses the sea.'
          : `No Roman road is known near ${why.end === 'a' ? a.name : b.name}, so only the straight line is shown.`;
    return (
      <div className="dp-road">
        <span className="dp-row-label">By road</span>
        <span className="dp-road-none">{text}</span>
      </div>
    );
  }
  const r = road.route;
  const d = formatDistance(r.miles);
  return (
    <div className="dp-road">
      <span className="dp-row-label">By road</span>
      <span>
        <span className="dp-number">{d.miles}</span> <span className="dp-km">({d.km})</span>
        <span className="dp-walk"> · {walkingTime(r.miles)}</span>
        {LIKELY_BY_SEA(r.miles, straight) && (
          <span className="dp-road-none"> Most travellers would have gone much of this way by sea.</span>
        )}
      </span>
    </div>
  );
}

/** Measures the distance between two places: by Roman road, and in a straight line. */
export default function DistancePanel({ measure, road, onChange, onClose }: Props) {
  const { a, b } = measure;
  const miles = a && b ? milesBetween(a, b) : null;
  const d = miles != null ? formatDistance(miles) : null;

  return (
    <div className="distance-panel" role="region" aria-label="Measure distance">
      <div className="dp-head">
        <span className="dp-title">Distance</span>
        <button className="icon-btn" onClick={onClose} aria-label="Close distance">
          ✕
        </button>
      </div>
      <PlacePicker label="From" value={a} onPick={(p) => onChange({ a: p, b })} autoFocus={!a} />
      <PlacePicker label="To" value={b} onPick={(p) => onChange({ a, b: p })} autoFocus={!!a && !b} />
      {d && miles != null && a && b ? (
        <div className="dp-result" aria-live="polite">
          <RoadLine road={road} straight={miles} a={a} b={b} />
          <div className="dp-row">
            <span className="dp-row-label">Straight line</span>
            <span>
              <strong>{d.miles}</strong> <span className="dp-km">({d.km})</span>
            </span>
          </div>
          <div className="dp-note">
            Walking times assume about 20 miles a day. Roads follow the Roman era (c. 300 BC – AD 300); many ran along older
            routes. Roads:{' '}
            <a href="https://itiner-e.org/" target="_blank" rel="noreferrer">
              Itiner-e
            </a>{' '}
            (
            <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">
              CC BY 4.0
            </a>
            ).
          </div>
        </div>
      ) : (
        <div className="dp-hint muted">Pick two places to see how far apart they are.</div>
      )}
    </div>
  );
}
