import { useEffect, useMemo, useState } from 'react';
import { getBook } from '../data/books';
import { parsePassage, type ParallelSet, type Passage } from '../data/parallels';
import { ESV_COPYRIGHT, fetchPassage, type Translation, type Verse } from '../lib/bible';

interface Props {
  set: ParallelSet;
  translation: Translation;
  esvKey?: string;
  /** the book being read, so its column comes first on phones and is marked */
  fromBook: string;
  onClose: () => void;
  onRead: (book: string, chapter: number, verse: number) => void;
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
export default function CompareGospels({ set, translation, esvKey, fromBook, onClose, onRead }: Props) {
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
  const [tab, setTab] = useState(() => Math.max(0, columns.findIndex(([b]) => b === fromBook)));
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

  const code = translation.code.toUpperCase();

  return (
    <div className="modal-backdrop compare-backdrop" onClick={onClose}>
      <div className="modal compare-modal" role="dialog" aria-label={`Compare: ${set.title}`} onClick={(e) => e.stopPropagation()}>
        <header className="compare-head">
          <div>
            <div className="compare-kicker">Compare the accounts · {code}</div>
            <h2>{set.title}</h2>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </header>

        <div className="compare-tabs" role="tablist">
          {columns.map(([b], i) => (
            <button key={b} role="tab" aria-selected={tab === i} className={tab === i ? 'on' : ''} onClick={() => setTab(i)}>
              {bookName(b)}
            </button>
          ))}
        </div>

        <div className="compare-cols" style={{ '--cols': columns.length } as React.CSSProperties}>
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
