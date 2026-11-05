import { useEffect, useRef, useState } from 'react';
import type { StudyList } from '../lib/lists';
import { formatOsis } from '../lib/placeInfo';

interface Props {
  list: StudyList;
  index: number;
  playing: boolean;
  onGo: (i: number) => void;
  onTogglePlay: () => void;
  onClose: () => void;
}

export default function ListPanel({ list, index, playing, onGo, onTogglePlay, onClose }: Props) {
  const [expanded, setExpanded] = useState(false);
  const listRef = useRef<HTMLOListElement>(null);
  const item = list.items[index];
  const last = list.items.length - 1;

  useEffect(() => {
    listRef.current?.querySelector('.current')?.scrollIntoView({ block: 'nearest' });
  }, [index, expanded]);

  return (
    <div className="list-panel" style={{ '--c': list.color } as React.CSSProperties}>
      <div className="lp-head">
        <div className="lp-title">
          <span className="lp-kicker">List</span> {list.title}
        </div>
        <button className="icon-btn" onClick={onClose} aria-label="Close list">
          ✕
        </button>
      </div>

      <div className="lp-item">
        <span className="lp-num">{index + 1}</span>
        <div className="lp-body">
          <div className="lp-name">
            {item.t.replace(/^\d+\.\s*/, '')}
            {item.tag && <span className={`lp-tag ${item.tag}`}>{item.tag === 'good' ? 'Good' : 'Evil'}</span>}
          </div>
          <div className="lp-meta">
            {formatOsis(item.ref)}
            {item.meta && <> · {item.meta}</>}
            {item.place && <> · {item.place}</>}
          </div>
          {item.note && <div className="lp-note">{item.note}</div>}
        </div>
      </div>

      <div className="jp-controls">
        <button className="btn" onClick={() => onGo(index - 1)} disabled={index === 0} aria-label="Previous">
          ‹<span className="jp-label"> Prev</span>
        </button>
        <button className="btn primary" onClick={onTogglePlay}>
          {playing ? '❚❚' : '▶'}
          <span className="jp-label">{playing ? ' Pause' : ' Play'}</span>
        </button>
        <button className="btn" onClick={() => onGo(index + 1)} disabled={index === last} aria-label="Next">
          <span className="jp-label">Next </span>›
        </button>
        <span className="jp-count">
          {index + 1}/{last + 1}
        </span>
        <button className="link" onClick={() => setExpanded(!expanded)}>
          {expanded ? 'Hide list' : 'Whole list'}
        </button>
      </div>

      {expanded && (
        <>
          <p className="lp-summary">
            {list.summary}
            {list.note && <span className="muted"> {list.note}</span>}
          </p>
          <ol className="jp-list lp-list" ref={listRef}>
            {list.items.map((it, i) => (
              <li key={i} className={i === index ? 'current' : i < index ? 'past' : ''}>
                <button onClick={() => onGo(i)}>
                  <span className="jp-li-num">{i + 1}</span> {it.t.replace(/^\d+\.\s*/, '')}
                  {it.tag && <span className={`lp-dot ${it.tag}`} title={it.tag} />}
                  <span className="muted"> · {it.meta ?? formatOsis(it.ref)}</span>
                </button>
              </li>
            ))}
          </ol>
        </>
      )}
    </div>
  );
}
