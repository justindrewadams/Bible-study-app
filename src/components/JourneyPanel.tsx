import { useEffect, useRef, useState } from 'react';
import type { Journey } from '../lib/journeys';

interface Props {
  journey: Journey;
  stopIndex: number;
  playing: boolean;
  onGo: (i: number) => void;
  onTogglePlay: () => void;
  onClose: () => void;
  onPlaceInfo: (placeIndex: number) => void;
}

const fmt = (ref: string) => {
  const [b, c, v] = ref.split('.');
  return `${b.replace(/^(\d)/, '$1 ')} ${c}:${v}`;
};

export default function JourneyPanel({ journey, stopIndex, playing, onGo, onTogglePlay, onClose, onPlaceInfo }: Props) {
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
          {stop.placeIndex != null && (
            <button className="link small" onClick={() => onPlaceInfo(stop.placeIndex!)}>
              About {stop.place} →
            </button>
          )}
        </div>
      </div>
      <div className="jp-controls">
        <button className="btn" onClick={() => onGo(0)} disabled={stopIndex === 0} aria-label="First stop">
          ⏮
        </button>
        <button className="btn" onClick={() => onGo(stopIndex - 1)} disabled={stopIndex === 0}>
          ‹ Prev
        </button>
        <button className="btn primary" onClick={onTogglePlay}>
          {playing ? '❚❚ Pause' : '▶ Play'}
        </button>
        <button className="btn" onClick={() => onGo(stopIndex + 1)} disabled={stopIndex === last}>
          Next ›
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
