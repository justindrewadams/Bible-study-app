/**
 * Notes for the selected verse (opened from "✎ Note" in the blue verse bar): notes on this verse or a range
 * that includes it, notebook pages that mention it, and a new note. A side panel on computers, a bottom
 * sheet on phones.
 */
import { useEffect, useState } from 'react';
import { noteSpan, pagesMentioning, placeName, useNotes, verseNotesAt, type Note, type NoteDraft } from '../lib/notes';
import { spanLabel, type Span } from '../lib/refs';
import NoteEditor from './NoteEditor';

interface Props {
  osis: string;
  chapter: number;
  verse: number;
  bookName: string;
  onClose: () => void;
  onOpenRef: (s: Span) => void;
  onOpenPage: (id: string) => void;
}

export default function VerseNotes({ osis, chapter, verse, bookName, onClose, onOpenRef, onOpenPage }: Props) {
  const store = useNotes();
  const pages = pagesMentioning(osis, chapter, verse, store);
  const [adding, setAdding] = useState<NoteDraft | null>(null);
  // a new note keeps its own editor after it first saves, so typing isn't interrupted
  const [addedId, setAddedId] = useState<string | null>(null);
  const here = verseNotesAt(osis, chapter, verse, store).filter((n) => n.id !== addedId);

  useEffect(() => {
    if (store.status === 'ready' && here.length === 0 && pages.length === 0 && !adding)
      setAdding({ kind: 'verse', ref: `${osis}.${chapter}.${verse}`, notebookId: null, body: '' });
  }, [osis, chapter, verse, store.status]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const sortByStart = (a: Note, b: Note) => (noteSpan(a)?.verse ?? 0) - (noteSpan(b)?.verse ?? 0) || a.createdAt - b.createdAt;

  return (
    <div className="modal-backdrop notes-backdrop" onClick={onClose}>
      <div className="modal acct verse-notes" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={`Notes on ${bookName} ${chapter}:${verse}`}>
        <div className="acct-head">
          <h2>
            Notes · {bookName} {chapter}:{verse}
          </h2>
          <button className="acct-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        {store.status === 'loading' && <p className="muted small">Loading your notes…</p>}
        {store.status === 'error' && <p className="acct-error">Couldn’t load your notes. Check your connection and try again.</p>}

        {[...here].sort(sortByStart).map((n) => {
          const sp = noteSpan(n);
          return (
            <section key={n.id} className="vn-item">
              <div className="vn-head">
                <span className="vn-ref">{sp ? spanLabel(sp) : ''}</span>
                {n.notebookId && <span className="muted small"> · {placeName(n.notebookId, store)}</span>}
              </div>
              <NoteEditor note={n} onOpenRef={onOpenRef} />
            </section>
          );
        })}

        {adding ? (
          <section className="vn-item vn-new">
            <div className="vn-head">
              <span className="vn-ref">New note</span>
            </div>
            <NoteEditor
              key="adding"
              note={adding}
              editing
              onOpenRef={onOpenRef}
              onSaved={(n) => setAddedId(n.id)}
              onDeleted={() => {
                setAdding(null);
                setAddedId(null);
              }}
            />
          </section>
        ) : (
          <button
            className="btn vn-add"
            onClick={() => setAdding({ kind: 'verse', ref: `${osis}.${chapter}.${verse}`, notebookId: null, body: '' })}
          >
            + New note on this verse
          </button>
        )}

        {pages.length > 0 && (
          <section className="vn-pages">
            <h3>In your notebook pages</h3>
            <ul>
              {pages.map((p) => (
                <li key={p.id}>
                  <button className="link-button vn-page" onClick={() => onOpenPage(p.id)}>
                    {p.title || 'Untitled page'}
                  </button>
                  <span className="muted small">
                    {' '}
                    · {placeName(p.notebookId, store) || 'Not in a notebook'}
                    {p.date ? ` · ${new Date(p.date + 'T12:00').toLocaleDateString()}` : ''}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
