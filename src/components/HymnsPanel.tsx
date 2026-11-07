import { useEffect, useState } from 'react';
import { getBook } from '../data/books';
import type { ChapterHymns, Hymn } from '../data/hymns';

interface Props {
  book: string;
  bookName: string;
  chapter: number;
  onClose: () => void;
}

/** "Ps.23.1-6" → "Psalm 23:1–6" */
function formatRef(ref: string): string {
  const [b, c, v] = ref.split('.');
  const name = b === 'Ps' ? 'Psalm' : getBook(b).name;
  return `${name} ${c}${v ? `:${v.replace('-', '–')}` : ''}`;
}

function HymnRow({ hymn, note }: { hymn: Hymn; note?: string }) {
  return (
    <li className="hymn">
      <div className="hymn-title">{hymn.title}</div>
      <div className="hymn-meta">
        {[hymn.by, hymn.year].filter(Boolean).join(', ')}
        {note && (
          <>
            {hymn.by || hymn.year ? ' · ' : ''}
            {note}
          </>
        )}
      </div>
    </li>
  );
}

/** Pop-up listing hymns tied to the open chapter. The data loads only when the pop-up is opened. */
export default function HymnsPanel({ book, bookName, chapter, onClose }: Props) {
  const [hymns, setHymns] = useState<ChapterHymns | null>(null);

  useEffect(() => {
    let live = true;
    import('../data/hymns').then((m) => live && setHymns(m.hymnsForChapter(book, chapter)));
    return () => {
      live = false;
    };
  }, [book, chapter]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const heading = `${book === 'Ps' ? 'Psalm' : bookName} ${chapter}`;

  return (
    <div className="modal-backdrop hymns-backdrop" onClick={onClose}>
      <div className="modal hymns-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={`Hymns for ${heading}`}>
        <div className="hymns-head">
          <h2>Hymns for {heading}</h2>
          <button className="hymns-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        {!hymns && <p className="muted">Loading…</p>}
        {hymns && (
          <>
            {hymns.from.length > 0 && (
              <section>
                <h3>Written from this chapter</h3>
                <ul className="hymn-list">
                  {hymns.from.map(({ hymn, ref }) => (
                    <HymnRow key={hymn.title} hymn={hymn} note={`from ${formatRef(ref)}`} />
                  ))}
                </ul>
              </section>
            )}
            {hymns.fits.length > 0 && (
              <section>
                <h3>Fits this chapter’s message</h3>
                <ul className="hymn-list">
                  {hymns.fits.map(({ hymn }) => (
                    <HymnRow key={hymn.title} hymn={hymn} />
                  ))}
                </ul>
              </section>
            )}
            {hymns.book.length > 0 && (
              <section>
                <h3>{hymns.from.length + hymns.fits.length ? 'Also for' : 'For'} the book of {bookName}</h3>
                <ul className="hymn-list">
                  {hymns.book.map((hymn) => (
                    <HymnRow key={hymn.title} hymn={hymn} />
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}
