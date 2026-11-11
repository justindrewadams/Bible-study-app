import { useEffect, useRef, useState } from 'react';
import type { Journey } from '../lib/journeys';
import { journeyLegs, loadRoads, type JourneyLeg } from '../lib/roads';
import { formatDistance, walkingTime } from '../lib/distance';

const legCache = new Map<string, (JourneyLeg | null)[]>();

/** The journey's legs along Roman roads where possible (null until the road map has loaded). */
export function useJourneyLegs(journey: Journey | null): (JourneyLeg | null)[] | null {
  const [legs, setLegs] = useState<(JourneyLeg | null)[] | null>(journey ? (legCache.get(journey.id) ?? null) : null);
  useEffect(() => {
    if (!journey) {
      setLegs(null);
      return;
    }
    const cached = legCache.get(journey.id);
    if (cached) {
      setLegs(cached);
      return;
    }
    setLegs(null);
    let live = true;
    loadRoads()
      .then((g) => {
        const l = journeyLegs(g, journey);
        legCache.set(journey.id, l);
        if (live) setLegs(l);
      })
      .catch(() => {}); // without the road map, legs stay as drawn
    return () => {
      live = false;
    };
  }, [journey]);
  return legs;
}

interface Props {
  journey: Journey;
  stopIndex: number;
  playing: boolean;
  onGo: (i: number) => void;
  onTogglePlay: () => void;
  onClose: () => void;
  onPlaceInfo: (placeIndex: number) => void;
  /** legs along roads (see useJourneyLegs), for the distance from the previous stop */
  legs?: (JourneyLeg | null)[] | null;
}

const fmt = (ref: string) => {
  const [b, c, v] = ref.split('.');
  return `${b.replace(/^(\d)/, '$1 ')} ${c}:${v}`;
};

export default function JourneyPanel({ journey, stopIndex, playing, onGo, onTogglePlay, onClose, onPlaceInfo, legs }: Props) {
  const leg = legs?.[stopIndex] ?? null;
  const prevStop = stopIndex > 0 ? journey.stops[stopIndex - 1] : null;
  const [expanded, setExpanded] = useState(false);
  const listRef = useRef<HTMLOListElement>(null);
  const stop = journey.stops[stopIndex];
  const last = journey.stops.length - 1;

  useEffect(() => {
    listRef.current?.querySelector('.current')?.scrollIntoView({ block: 'nearest' });
  }, [stopIndex, expanded]);

  return (
    <div className="journey-panel" style={{ '--c': journey.color } as React.CSSProperties}>
      <div className="jp-head">
        <div>
          <div className="jp-title">{journey.title}</div>
          <div className="jp-era">{journey.era}</div>
        </div>
        <button className="icon-btn" onClick={onClose} aria-label="Close journey">
          ✕
        </button>
      </div>
      <div className="jp-stop">
        <span className="jp-num">{stopIndex + 1}</span>
        <div>
          <div className="jp-place">
            {stop.place} <span className="muted">· {fmt(stop.ref)}</span>
          </div>
          <div className="jp-note">{stop.note}</div>
          {leg && prevStop && leg.miles >= 0.5 && (
            <div className="jp-leg">
              {formatDistance(leg.miles).miles} from {prevStop.place}{' '}
              {leg.how === 'road'
                ? `by road · ${walkingTime(leg.miles)}`
                : leg.how === 'sea'
                  ? 'by sea'
                  : leg.how === 'traced'
                    ? 'along the usual route'
                    : 'as the crow flies'}
            </div>
          )}
          {stop.placeIndex != null && (
            <button className="link small" onClick={() => onPlaceInfo(stop.placeIndex!)}>
              About {stop.place} →
            </button>
          )}
        </div>
      </div>
      <div className="jp-controls">
        <button className="btn jp-first" onClick={() => onGo(0)} disabled={stopIndex === 0} aria-label="First stop">
          ⏮
        </button>
        <button className="btn" onClick={() => onGo(stopIndex - 1)} disabled={stopIndex === 0} aria-label="Previous stop">
          ‹<span className="jp-label"> Prev</span>
        </button>
        <button className="btn primary" onClick={onTogglePlay}>
          {playing ? '❚❚' : '▶'}
          <span className="jp-label">{playing ? ' Pause' : ' Play'}</span>
        </button>
        <button className="btn" onClick={() => onGo(stopIndex + 1)} disabled={stopIndex === last} aria-label="Next stop">
          <span className="jp-label">Next </span>›
        </button>
        <span className="jp-count">
          {stopIndex + 1}/{last + 1}
        </span>
        <button className="link" onClick={() => setExpanded(!expanded)}>
          {expanded ? 'Hide stops' : 'All stops'}
        </button>
      </div>
      <div className="jp-progress">
        <div style={{ width: `${(stopIndex / Math.max(1, last)) * 100}%` }} />
      </div>
      {expanded && (
        <ol className="jp-list" ref={listRef}>
          {journey.stops.map((s, i) => (
            <li key={i} className={i === stopIndex ? 'current' : i < stopIndex ? 'past' : ''}>
              <button onClick={() => onGo(i)}>
                <span className="jp-li-num">{i + 1}</span> {s.place}
                <span className="muted"> · {fmt(s.ref)}</span>
              </button>
            </li>
          ))}
        </ol>
      )}
      {stopIndex === 0 && !expanded && <p className="jp-summary">{journey.summary}</p>}
    </div>
  );
}
