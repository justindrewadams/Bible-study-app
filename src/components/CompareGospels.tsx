import { useEffect, useMemo, useRef, useState } from 'react';
import { getBook } from '../data/books';
import { PARALLELS, parsePassage, type ParallelSet, type Passage } from '../data/parallels';
import TextSizeControl, { useTextPrefs } from './TextSizeControl';
import { ESV_COPYRIGHT, fetchPassage, type Translation, type Verse } from '../lib/bible';

interface Props {
  set: ParallelSet;
  translation: Translation;
  esvKey?: string;
  /** the book being read, so its column comes first on phones and is marked */
  fromBook: string;
  onClose: () => void;
  onRead: (book: string, chapter: number, verse: number) => void;
  /** move to the previous (-1) or next (+1) event in the parallels table */
  onStep: (d: number) => void;
  /** open already presenting (the app was presenting when this was opened) */
  startPresenting?: boolean;
}

const ORDER = ['Matt', 'Mark', 'Luke', 'John'];
const bookName = (b: string) => getBook(b).name;
const rangeLabel = (p: Passage) => `${bookName(p.book)} ${p.chapter}:${p.from}${p.to !== p.from ? `–${p.to}` : ''}`;

type Loaded = { state: 'loading' } | { state: 'ok'; verses: Verse[] } | { state: 'error'; message: string };

/**
 * The accounts of one event side by side (stacked behind tabs on phones), in the reader's translation.
 * Each passage is fetched like a page of the reader, so the ESV's limits (500 verses a page, half a book,
 * 500 verses kept in memory) still hold; the longest set here is about 120 verses.
 */
export default function CompareGospels({ set, translation, esvKey, fromBook, onClose, onRead, onStep, startPresenting = false }: Props) {
  // one column per book, in Gospel order (Acts or 1 Corinthians last)
  const columns = useMemo(() => {
    const byBook = new Map<string, { raw: string; p: Passage }[]>();
    for (const raw of set.passages) {
      const p = parsePassage(raw);
      byBook.set(p.book, [...(byBook.get(p.book) ?? []), { raw, p }]);
    }
    return [...byBook.entries()].sort(
      ([a], [b]) => (ORDER.indexOf(a) + 1 || 9) - (ORDER.indexOf(b) + 1 || 9),
    );
  }, [set]);
  const [tabState, setTab] = useState(() => Math.max(0, columns.findIndex(([b]) => b === fromBook)));
  const tab = Math.min(tabState, columns.length - 1);
  const [loaded, setLoaded] = useState<Record<string, Loaded>>({});

  useEffect(() => {
    let live = true;
    setLoaded({});
    for (const p of set.passages) {
      const x = parsePassage(p);
      fetchPassage(translation, x.book, x.chapter, { from: x.from, to: x.to }, { esvKey })
        .then((vs) => {
          const verses = vs.filter((v) => v.verse >= x.from && v.verse <= x.to);
          if (live) setLoaded((l) => ({ ...l, [p]: { state: 'ok', verses } }));
        })
        .catch((e: Error) => live && setLoaded((l) => ({ ...l, [p]: { state: 'error', message: e.message } })));
    }
    return () => {
      live = false;
    };
  }, [set, translation, esvKey]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // a new event starts each account at its top
  const colsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    colsRef.current?.querySelectorAll('.compare-col').forEach((c) => (c.scrollTop = 0));
  }, [set]);

  // ---- Presenting: full screen, larger text, ← → (or a clicker) for the previous / next event
  const at = PARALLELS.findIndex((s) => s.id === set.id);
  const prevSet = at > 0 ? PARALLELS[at - 1] : null;
  const nextSet = at >= 0 && at < PARALLELS.length - 1 ? PARALLELS[at + 1] : null;
  const [presenting, setPresenting] = useState(startPresenting);
  const ownFullscreen = useRef(false);
  const stepRef = useRef(onStep);
  stepRef.current = onStep;
  const startPresentingHere = () => {
    setPresenting(true);
    if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
      ownFullscreen.current = true;
      document.documentElement.requestFullscreen().catch(() => (ownFullscreen.current = false));
    }
  };
  const stopPresentingHere = () => {
    setPresenting(false);
    if (ownFullscreen.current && document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    ownFullscreen.current = false;
  };
  const stopRef = useRef(stopPresentingHere);
  stopRef.current = stopPresentingHere;
  useEffect(() => {
    if (!presenting) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.target instanceof Element && e.target.closest('input, select, textarea')) return;
      if (e.key === 'Escape') {
        // Esc ends presenting first; a second Esc closes the comparison
        if (document.querySelector('.compare-modal .text-pop')) return;
        e.stopPropagation();
        stopRef.current();
        return;
      }
      const forward = ['ArrowRight', 'PageDown', ' ', 'Enter'].includes(e.key);
      const back = ['ArrowLeft', 'PageUp', 'Backspace'].includes(e.key);
      if (!forward && !back) return; // ↑ ↓ still scroll an account
      e.preventDefault();
      e.stopPropagation();
      stepRef.current(forward ? 1 : -1);
    };
    const onFull = () => {
      if (!document.fullscreenElement && ownFullscreen.current) {
        ownFullscreen.current = false;
        setPresenting(false);
      }
    };
    window.addEventListener('keydown', onKey, true);
    document.addEventListener('fullscreenchange', onFull);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      document.removeEventListener('fullscreenchange', onFull);
    };
  }, [presenting]);

  const code = translation.code.toUpperCase();
  const { prefs: textPrefs, scale: textScale } = useTextPrefs();

  return (
    <div className={`modal-backdrop compare-backdrop${presenting ? ' presenting' : ''}`} onClick={presenting ? undefined : onClose}>
      <div className="modal compare-modal" role="dialog" aria-label={`Compare: ${set.title}`} onClick={(e) => e.stopPropagation()}>
        <header className="compare-head">
          <div>
            <div className="compare-kicker">Compare the accounts · {code}</div>
            <h2>{set.title}</h2>
          </div>
          <div className="compare-tools">
            {!presenting && (
              <button
                className="hymns-btn present-btn"
                onClick={startPresentingHere}
                title="Present on a TV or projector: full screen, large text, ← → for the previous or next event"
              >
                <span aria-hidden="true">⛶</span> Present
              </button>
            )}
            <TextSizeControl />
            <button className="icon-btn" onClick={onClose} aria-label="Close">
              ✕
            </button>
          </div>
        </header>

        {presenting && (
          <div className="present-bar compare-present-bar" role="toolbar" aria-label="Presenting">
            <button className="present-step" onClick={() => onStep(-1)} disabled={!prevSet} aria-label="Previous event">
              ‹
            </button>
            <span className="present-where">
              Event {at + 1} of {PARALLELS.length}
              {nextSet && <span className="present-next"> · next: {nextSet.title}</span>}
            </span>
            <button className="present-step" onClick={() => onStep(1)} disabled={!nextSet} aria-label="Next event">
              ›
            </button>
            <span className="present-hint">← → or a clicker for the previous / next event · Esc to finish</span>
            <button className="btn present-exit" onClick={stopPresentingHere}>
              Finish presenting
            </button>
          </div>
        )}

        <div className="compare-tabs" role="tablist">
          {columns.map(([b], i) => (
            <button key={b} role="tab" aria-selected={tab === i} className={tab === i ? 'on' : ''} onClick={() => setTab(i)}>
              {bookName(b)}
            </button>
          ))}
        </div>

        <div
          ref={colsRef}
          className={`compare-cols${textPrefs.bold ? ' bolder' : ''}`}
          style={{ '--cols': columns.length, '--text-scale': textScale } as React.CSSProperties}
        >
          {columns.map(([b, passages], i) => (
            <section key={b} className={`compare-col${tab === i ? ' on' : ''}${b === fromBook ? ' here' : ''}`}>
              <h3>{bookName(b)}</h3>
              {passages.map(({ raw, p }) => {
                const l = loaded[raw] ?? { state: 'loading' };
                return (
                  <div key={raw} className="compare-passage">
                    <button className="compare-ref" onClick={() => onRead(p.book, p.chapter, p.from)} title="Read in the reader">
                      {rangeLabel(p)} ›
                    </button>
                    {l.state === 'loading' && <p className="muted small">Loading…</p>}
                    {l.state === 'error' && <p className="muted small">Couldn’t load this passage. {l.message}</p>}
                    {l.state === 'ok' && (
                      <p className="compare-text">
                        {l.verses.map((v) => (
                          <span key={v.verse}>
                            <sup className="vnum">{v.verse}</sup>
                            {v.text}{' '}
                          </span>
                        ))}
                      </p>
                    )}
                  </div>
                );
              })}
            </section>
          ))}
        </div>

        <footer className="compare-foot">
          {translation.provider === 'esv' ? ESV_COPYRIGHT : translation.notice ?? `${code} · ${translation.name}, public domain.`}
        </footer>
      </div>
    </div>
  );
}
