import { useEffect, useMemo, useRef, useState } from 'react';
import { loadPlaces, type Place } from '../lib/geo';
import { loadPlaceDetails } from '../lib/placeInfo';
import { formatDistance, milesBetween, walkingTime } from '../lib/distance';
import { norm } from '../lib/search';

export interface Measure {
  a: Place | null;
  b: Place | null;
}

interface Props {
  measure: Measure;
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

/** Measures the straight-line distance between two places. */
export default function DistancePanel({ measure, onChange, onClose }: Props) {
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
      {d && miles != null ? (
        <div className="dp-result" aria-live="polite">
          <div className="dp-number">
            {d.miles} <span className="dp-km">({d.km})</span>
          </div>
          <div className="dp-note">
            In a straight line · {walkingTime(miles)} at about 20 miles a day. Real roads, hills and sea routes made
            journeys longer.
          </div>
        </div>
      ) : (
        <div className="dp-hint muted">Pick two places to see how far apart they are.</div>
      )}
    </div>
  );
}
