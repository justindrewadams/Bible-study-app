/**
 * "Download": your lesson, page, notebook, verse notes, journey or list (or everything) as a printable page
 * ("Print / Save as PDF") or an editable Word file. See lib/exportDoc.ts for what Bible text each may carry.
 * The print preview is a sheet over the app; printing shows only the sheet.
 */
import { Fragment, useEffect, useMemo, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { BOOKS } from '../data/books';
import { isLicensed, type Translation } from '../lib/bible';
import { toDocx } from '../lib/docx';
import {
  everythingDoc,
  fileName,
  fillPassages,
  hasPassages,
  lessonDoc,
  mineDoc,
  notebookDoc,
  pageDoc,
  readUrl,
  translationsFor,
  verseLimit,
  verseNotesDoc,
  type Block,
  type ExportDoc,
  type Run,
} from '../lib/exportDoc';
import { noteSpan, useNotes } from '../lib/notes';
import { spanLabel } from '../lib/refs';

export type ExportTarget =
  | { kind: 'lesson' | 'page' | 'journey' | 'list' | 'notebook'; id: string }
  | { kind: 'verses' }
  | { kind: 'all' };

interface Props {
  target: ExportTarget;
  /** the translation being read: offered for printing when it is a licensed one */
  translation: Translation;
  onClose: () => void;
}

export default function ExportDialog({ target, translation, onClose }: Props) {
  const store = useNotes();
  const [format, setFormat] = useState<'print' | 'word'>('print');
  const [withNotes, setWithNotes] = useState(true);
  const [book, setBook] = useState('');
  const options = translationsFor(format, translation);
  const pdDefault = isLicensed(translation) ? 'bibleapi:kjv' : translation.id;
  const [textId, setTextId] = useState<string>(isLicensed(translation) ? translation.id : pdDefault);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<ExportDoc | null>(null);

  // a licensed translation isn't offered for Word: fall back to the KJV
  const chosen = textId === 'none' ? null : options.find((t) => t.id === textId) ?? null;
  useEffect(() => {
    if (textId !== 'none' && !options.some((t) => t.id === textId)) setTextId(pdDefault);
  }, [format]); // eslint-disable-line react-hooks/exhaustive-deps

  const verseBooks = useMemo(() => {
    const set = new Set(store.notes.filter((n) => n.kind === 'verse').map((n) => noteSpan(n)?.osis).filter(Boolean));
    return BOOKS.filter((b) => set.has(b.osis));
  }, [store.notes]);

  const base = useMemo((): ExportDoc | null => {
    const n = 'id' in target ? store.notes.find((x) => x.id === target.id) : undefined;
    switch (target.kind) {
      case 'lesson':
        return n ? lessonDoc(n, { notes: withNotes }) : null;
      case 'page':
        return n ? pageDoc(n) : null;
      case 'journey':
      case 'list':
        return n ? mineDoc(n) : null;
      case 'notebook':
        return store.notebooks.some((b) => b.id === target.id) ? notebookDoc(target.id, store) : null;
      case 'verses':
        return verseNotesDoc(store.notes, book || undefined);
      case 'all':
        return everythingDoc(store, { notes: true });
    }
  }, [target, store, withNotes, book]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !preview && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, preview]);

  if (preview) return <PrintSheet doc={preview} onClose={() => setPreview(null)} />;

  const passages = base ? hasPassages(base) : false;
  const limit = chosen && isLicensed(chosen) ? verseLimit(chosen).total : 0;

  const go = async () => {
    if (!base) return;
    setError(null);
    setBusy(chosen && passages ? 'Getting the verses…' : 'Preparing…');
    try {
      const doc = await fillPassages(base, passages ? chosen : null, format, (done, total) =>
        setBusy(total > 1 ? `Getting the verses… ${done} of ${total}` : 'Getting the verses…'),
      );
      if (format === 'print') setPreview(doc);
      else {
        const blob = toDocx(doc);
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = fileName(doc.title, 'docx');
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 60_000);
        onClose();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Couldn’t make the download.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal acct export-dialog" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Download">
        <div className="acct-head">
          <h2>Download</h2>
          <button className="acct-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        {!base ? (
          <p className="acct-error">This is no longer there.</p>
        ) : (
          <>
            <p className="small muted export-what">
              {base.title === 'My Content' ? 'Everything in My Content' : `“${base.title}”`}, to keep, print or work on outside the app.
            </p>
            <div className="export-formats" role="radiogroup" aria-label="Format">
              <label className={`export-format${format === 'print' ? ' on' : ''}`}>
                <input type="radio" name="export-format" checked={format === 'print'} onChange={() => setFormat('print')} />
                <span>
                  <strong>Print or save as PDF</strong>
                  <span className="small muted">A clean page to print or keep as a PDF</span>
                </span>
              </label>
              <label className={`export-format${format === 'word' ? ' on' : ''}`}>
                <input type="radio" name="export-format" checked={format === 'word'} onChange={() => setFormat('word')} />
                <span>
                  <strong>Word document</strong>
                  <span className="small muted">Editable in Word, Pages or Google Docs</span>
                </span>
              </label>
            </div>

            {target.kind === 'verses' && verseBooks.length > 1 && (
              <label className="note-meta">
                <span>Which notes</span>
                <select value={book} onChange={(e) => setBook(e.target.value)}>
                  <option value="">All verse notes</option>
                  {verseBooks.map((b) => (
                    <option key={b.osis} value={b.osis}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </label>
            )}

            {passages && (
              <label className="note-meta">
                <span>Bible text</span>
                <select value={chosen ? chosen.id : 'none'} onChange={(e) => setTextId(e.target.value)}>
                  <option value="none">References only</option>
                  {options.map((t) => (
                    <option key={t.id} value={t.id}>
                      {(t.provider === 'bibleapi' ? t.code.toUpperCase() : t.code === 'NASB1995' ? 'NASB 1995' : t.code) + ' — ' + t.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {passages && format === 'word' && isLicensed(translation) && (
              <p className="small muted export-hint">
                Word files can include public-domain translations only, because they can be edited and passed
                around. To include the {translation.code === 'NASB1995' ? 'NASB 1995' : translation.code}, choose Print or save as PDF.
              </p>
            )}
            {passages && format === 'print' && limit > 0 && (
              <p className="small muted export-hint">
                The publisher allows up to {limit} verses of the {chosen!.code === 'NASB1995' ? 'NASB 1995' : chosen!.code} in one
                printout{chosen!.provider === 'esv' ? ', and never half of a book' : ''}. Any passages past that print as references.
              </p>
            )}

            {target.kind === 'lesson' && (
              <label className="acct-check">
                <input type="checkbox" checked={withNotes} onChange={(e) => setWithNotes(e.target.checked)} />
                <span>Include my notes (untick for a class handout)</span>
              </label>
            )}

            {error && <p className="acct-error">{error}</p>}
            <div className="acct-actions">
              <button className="btn primary" onClick={go} disabled={!!busy}>
                {busy ?? (format === 'print' ? 'Preview and print' : 'Download Word file')}
              </button>
              <button className="btn" onClick={onClose}>
                Cancel
              </button>
            </div>
            <p className="small muted export-hint">Made on your device. Nothing is sent anywhere.</p>
          </>
        )}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------------------ the print sheet

function runs(list: Run[]): ReactNode[] {
  return list.map((r, i) => {
    let node: ReactNode = r.text;
    if (r.i) node = <em>{node}</em>;
    if (r.b) node = <strong>{node}</strong>;
    if (r.href) node = <a href={r.href}>{node}</a>;
    return (
      <Fragment key={i}>
        {r.br && <br />}
        {node}
      </Fragment>
    );
  });
}

function DocBlock({ b }: { b: Block }) {
  switch (b.t) {
    case 'h': {
      const H = (`h${b.level + 1}` as 'h2' | 'h3' | 'h4');
      return <H>{runs(b.runs)}</H>;
    }
    case 'p':
      return <p className={b.muted ? 'pd-meta' : undefined}>{runs(b.runs)}</p>;
    case 'quote':
      return <blockquote>{runs(b.runs)}</blockquote>;
    case 'list': {
      const L = b.ordered ? 'ol' : 'ul';
      return (
        <L>
          {b.items.map((it, i) => (
            <li key={i}>{runs(it)}</li>
          ))}
        </L>
      );
    }
    case 'passage': {
      let last = b.span.chapter;
      return (
        <div className="pd-passage">
          {!b.hideRef && (
            <p className="pd-ref">
              <a href={readUrl(b.span)}>{spanLabel(b.span)}</a>
            </p>
          )}
          {b.verses && (
            <p className="pd-verses">
              {b.verses.map((v, i) => {
                const num = v.chapter !== last ? `${v.chapter}:${v.verse}` : `${v.verse}`;
                last = v.chapter;
                return (
                  <Fragment key={i}>
                    <sup>{num}</sup> {v.text}{' '}
                  </Fragment>
                );
              })}
              {b.code && <span className="pd-code">({b.code})</span>}
            </p>
          )}
        </div>
      );
    }
  }
}

function PrintSheet({ doc, onClose }: { doc: ExportDoc; onClose: () => void }) {
  useEffect(() => {
    document.body.classList.add('printing-doc');
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.classList.remove('printing-doc');
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);
  const made = new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
  return createPortal(
    <div className="print-sheet" role="dialog" aria-label={`Print preview: ${doc.title}`}>
      <div className="print-bar">
        <button className="btn" onClick={onClose}>
          ‹ Back
        </button>
        <span className="print-bar-title">Print preview</span>
        <button className="btn primary" onClick={() => window.print()}>
          Print / Save as PDF
        </button>
      </div>
      <p className="print-tip small">
        To keep a PDF, choose “Save as PDF” as the printer (on an iPhone or iPad: tap Print, then the share button,
        then Save to Files).
      </p>
      <article className="print-doc">
        <h1>{doc.title}</h1>
        {doc.subtitle && <p className="pd-sub">{doc.subtitle}</p>}
        {doc.blocks.map((b, i) => (
          <DocBlock key={i} b={b} />
        ))}
        <footer className="pd-credits">
          {doc.credits.map((c, i) => (
            <p key={i}>{c.href ? <a href={c.href}>{c.text}</a> : c.text}</p>
          ))}
          <p>
            Made with Ancient Pathfinder on {made}. <a href="https://ancientpathfinder.com/">ancientpathfinder.com</a>
          </p>
        </footer>
      </article>
    </div>,
    document.body,
  );
}
