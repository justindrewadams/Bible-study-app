/**
 * Writing a verse note or a notebook page: formatting buttons (hidden behind "Aa" on phones), "Insert
 * verse" (KJV or WEB wording, which may be kept), saving as you type, and the licensed-text block: wording
 * from the ESV, NASB 1995, CSB or NKJV can't be saved (the owner's choice: block, not warn).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { versesInChapter } from '../lib/bible';
import { findLicensedCopies, publicDomainText, type LicensedCopy } from '../lib/licenseGuard';
import {
  deleteNote,
  notebooksOf,
  NoteConflict,
  PAGE_MAX,
  saveNote,
  useNotes,
  VERSE_NOTE_MAX,
  type Note,
  type NoteDraft,
} from '../lib/notes';
import { findRefs, parsePassages, spanFromOsis, spanLabel, spanToOsis, type Span } from '../lib/refs';
import NoteText from './NoteText';

interface Props {
  /** an existing note, or the starting values of a new one */
  note: Note | NoteDraft;
  /** start in writing mode (new notes do) */
  editing?: boolean;
  onOpenRef: (s: Span) => void;
  onSaved?: (n: Note) => void;
  onDeleted?: () => void;
  /** for pages: hide the notebook picker (the Notes page shows where the page is) */
  compact?: boolean;
}

type Status = 'idle' | 'saved' | 'unsaved' | 'saving' | 'blocked' | 'conflict' | 'error';

const wide = () => typeof window !== 'undefined' && window.matchMedia('(min-width: 861px)').matches;

export default function NoteEditor({ note, editing: startEditing, onOpenRef, onSaved, onDeleted, compact }: Props) {
  const notes = useNotes();
  const [id, setId] = useState(note.id);
  const [version, setVersion] = useState(note.version);
  const [body, setBody] = useState(note.body);
  const [title, setTitle] = useState(note.title ?? '');
  const [date, setDate] = useState(note.date ?? '');
  const [passagesText, setPassagesText] = useState(
    (note.passages ?? [])
      .map(spanFromOsis)
      .filter((x): x is Span => !!x)
      .map(spanLabel)
      .join('; '),
  );
  const [notebookId, setNotebookId] = useState(note.notebookId);
  const [end, setEnd] = useState(note.end ?? '');
  const [editing, setEditing] = useState(!!startEditing || !note.id);
  const [status, setStatus] = useState<Status>(note.id ? 'saved' : 'idle');
  const [copies, setCopies] = useState<LicensedCopy[]>([]);
  const [conflict, setConflict] = useState<Note | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tools, setTools] = useState(wide());
  const [inserting, setInserting] = useState(false);
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const dirty = useRef(false);
  const kind = note.kind;
  const max = kind === 'verse' ? VERSE_NOTE_MAX : PAGE_MAX;
  const start = kind === 'verse' && note.ref ? spanFromOsis(note.ref) : null;

  const draft = useCallback((): NoteDraft => {
    const base: NoteDraft = { id, version, kind, notebookId, body };
    if (kind === 'verse') return { ...base, ref: note.ref, end: end && end !== note.ref ? end : undefined };
    return { ...base, title: title.trim(), date: date || undefined, passages: parsePassages(passagesText).map(spanToOsis) };
  }, [id, version, kind, notebookId, body, note.ref, end, title, date, passagesText]);

  const save = useCallback(async () => {
    if (!dirty.current) return true;
    if (!body.trim() && !title.trim() && !id) return true; // nothing written yet
    setStatus('saving');
    const found = await findLicensedCopies(body);
    if (found.length) {
      setCopies(found);
      setStatus('blocked');
      return false;
    }
    setCopies([]);
    try {
      dirty.current = false;
      const saved = await saveNote(draft());
      setId(saved.id);
      setVersion(saved.version);
      setStatus('saved');
      setError(null);
      onSaved?.(saved);
      return true;
    } catch (e) {
      dirty.current = true;
      if (e instanceof NoteConflict) {
        setConflict(e.latest);
        setStatus('conflict');
      } else {
        setError(e instanceof Error ? e.message : 'Couldn’t save.');
        setStatus('error');
      }
      return false;
    }
  }, [body, title, id, draft, onSaved]);

  // save a moment after typing stops
  useEffect(() => {
    if (!dirty.current || status === 'conflict') return;
    const t = setTimeout(save, 1500);
    return () => clearTimeout(t);
  }, [body, title, date, passagesText, notebookId, end]); // eslint-disable-line react-hooks/exhaustive-deps

  // save straight away when the editor closes
  const saveRef = useRef(save);
  saveRef.current = save;
  useEffect(() => () => void saveRef.current(), []);

  const change = <T,>(set: (v: T) => void) => (v: T) => {
    dirty.current = true;
    setStatus('unsaved');
    set(v);
  };

  // ---- formatting buttons: they add the simple marks the note view understands
  const wrap = (mark: string) => {
    const el = areaRef.current;
    if (!el) return;
    const { selectionStart: a, selectionEnd: b } = el;
    const sel = body.slice(a, b) || (mark === '**' ? 'bold' : 'italic');
    const next = body.slice(0, a) + mark + sel + mark + body.slice(b);
    change(setBody)(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(a + mark.length, a + mark.length + sel.length);
    });
  };
  const prefix = (p: string) => {
    const el = areaRef.current;
    if (!el) return;
    const a = el.selectionStart;
    const b = el.selectionEnd;
    const lineStart = body.lastIndexOf('\n', a - 1) + 1;
    const lineEnd = body.indexOf('\n', b) === -1 ? body.length : body.indexOf('\n', b);
    const lines = body.slice(lineStart, lineEnd).split('\n');
    const strip = (l: string) => l.replace(/^(#{1,3}\s+|\s*[-*•]\s+|\s*\d{1,3}[.)]\s+|>\s?)/, '');
    const already = lines.every((l) => (p === '1. ' ? /^\s*\d{1,3}[.)]\s/.test(l) : l.startsWith(p)));
    const done = lines.map((l, i) => (already ? strip(l) : (p === '1. ' ? `${i + 1}. ` : p) + strip(l))).join('\n');
    change(setBody)(body.slice(0, lineStart) + done + body.slice(lineEnd));
    requestAnimationFrame(() => el.focus());
  };
  const insertAtCursor = (text: string) => {
    const el = areaRef.current;
    const a = el?.selectionStart ?? body.length;
    const before = body.slice(0, a);
    const sep = before && !before.endsWith('\n') ? '\n' : '';
    const next = before + sep + text + '\n' + body.slice(a);
    change(setBody)(next);
  };

  // ---- licensed wording: replace it with the reference or public-domain wording
  const replaceCopy = async (c: LicensedCopy, how: 'ref' | 'kjv' | 'web') => {
    let text = c.label;
    if (how !== 'ref') {
      try {
        text = `“${await publicDomainText(how, c.span)}” (${c.label}, ${how.toUpperCase()})`;
      } catch {
        setError('Couldn’t load that wording right now. Try “Use the reference”.');
        return;
      }
    }
    const next = body.slice(0, c.start) + text + body.slice(c.end);
    setCopies((cs) => cs.filter((x) => x !== c).map((x) => (x.start > c.start ? { ...x, start: x.start + text.length - (c.end - c.start), end: x.end + text.length - (c.end - c.start) } : x)));
    change(setBody)(next);
  };

  const remove = async () => {
    if (!id) return onDeleted?.();
    if (!confirm(kind === 'verse' ? 'Delete this note?' : 'Delete this page? This can’t be undone.')) return;
    try {
      dirty.current = false;
      await deleteNote(id);
      onDeleted?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Couldn’t delete.');
    }
  };

  const resolveConflict = (keepMine: boolean) => {
    if (!conflict) return;
    setVersion(conflict.version);
    if (!keepMine) {
      setBody(conflict.body);
      setTitle(conflict.title ?? '');
      setDate(conflict.date ?? '');
      setNotebookId(conflict.notebookId);
      dirty.current = false;
      setStatus('saved');
    } else {
      dirty.current = true;
      setStatus('unsaved');
    }
    setConflict(null);
  };

  const verseCount = start ? versesInChapter(start.osis, start.chapter) : 0;
  const notebooks = notebooksOf(null, notes.notebooks);
  const passageSpans = parsePassages(passagesText);
  const statusText =
    status === 'saved' ? 'Saved' : status === 'saving' ? 'Saving…' : status === 'unsaved' ? 'Not saved yet' : status === 'error' ? 'Not saved' : '';

  return (
    <div className="note-editor">
      {kind === 'page' && (
        <div className="note-page-fields">
          <input
            className="note-title"
            value={title}
            onChange={(e) => change(setTitle)(e.target.value)}
            placeholder="Title (e.g. The Last Supper)"
            maxLength={200}
            aria-label="Title"
          />
          <div className="note-meta-row">
            <label className="note-meta">
              <span>Date</span>
              <input type="date" value={date} onChange={(e) => change(setDate)(e.target.value)} />
            </label>
            <label className="note-meta grow">
              <span>Passages</span>
              <input
                value={passagesText}
                onChange={(e) => change(setPassagesText)(e.target.value)}
                placeholder="e.g. Matt 26:17-30; Luke 22"
              />
            </label>
          </div>
          {passageSpans.length > 0 && (
            <div className="note-passages">
              {passageSpans.map((s, i) => (
                <button key={i} type="button" className="note-ref chip-ref" onClick={() => onOpenRef(s)}>
                  {spanLabel(s)}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {kind === 'verse' && start && editing && (
        <div className="note-meta-row">
          <label className="note-meta">
            <span>Verses</span>
            <span className="note-range">
              {spanLabel(start)} to{' '}
              <select
                value={end ? spanFromOsis(end)?.verse ?? start.verse ?? '' : start.verse ?? ''}
                onChange={(e) => change(setEnd)(`${start.osis}.${start.chapter}.${e.target.value}`)}
                aria-label="Last verse"
              >
                {Array.from({ length: verseCount - (start.verse ?? 1) + 1 }, (_, i) => (start.verse ?? 1) + i).map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </span>
          </label>
        </div>
      )}

      {(!compact || kind === 'verse') && (editing || kind === 'page') && (
        <label className="note-meta">
          <span>{kind === 'verse' ? 'Notebook (optional)' : 'Notebook'}</span>
          <select value={notebookId ?? ''} onChange={(e) => change(setNotebookId)(e.target.value || null)}>
            <option value="">{kind === 'verse' ? 'Not in a notebook' : 'Choose a notebook…'}</option>
            {notebooks.map((b) => [
              <option key={b.id} value={b.id}>
                {b.name}
              </option>,
              ...notebooksOf(b.id, notes.notebooks).map((f) => (
                <option key={f.id} value={f.id}>
                  {b.name} › {f.name}
                </option>
              )),
            ])}
          </select>
        </label>
      )}

      {editing ? (
        <>
          <div className="note-tools-row">
            <button
              type="button"
              className={`note-tool-toggle${tools ? ' on' : ''}`}
              onClick={() => setTools(!tools)}
              aria-pressed={tools}
              title="Formatting"
            >
              Aa
            </button>
            {tools && (
              <div className="note-tools" role="toolbar" aria-label="Formatting">
                <button type="button" onClick={() => wrap('**')} title="Bold" aria-label="Bold">
                  <strong>B</strong>
                </button>
                <button type="button" onClick={() => wrap('*')} title="Italic" aria-label="Italic">
                  <em>I</em>
                </button>
                <button type="button" onClick={() => prefix('## ')} title="Heading" aria-label="Heading">
                  H
                </button>
                <button type="button" onClick={() => prefix('- ')} title="Bullet list" aria-label="Bullet list">
                  •
                </button>
                <button type="button" onClick={() => prefix('1. ')} title="Numbered list" aria-label="Numbered list">
                  1.
                </button>
                <button type="button" onClick={() => prefix('> ')} title="Quote" aria-label="Quote">
                  ❝
                </button>
              </div>
            )}
            <button type="button" className="note-insert-btn" onClick={() => setInserting(!inserting)} aria-expanded={inserting}>
              + Verse text
            </button>
          </div>
          {inserting && (
            <InsertVerse
              defaultRef={start ? spanLabel(end ? { ...start, toVerse: spanFromOsis(end)?.verse ?? start.verse } : start) : passageSpans[0] ? spanLabel(passageSpans[0]) : ''}
              onInsert={(t) => {
                insertAtCursor(t);
                setInserting(false);
              }}
            />
          )}
          <textarea
            ref={areaRef}
            className="note-area"
            value={body}
            onChange={(e) => change(setBody)(e.target.value)}
            placeholder={kind === 'verse' ? 'Your thoughts on this passage…' : 'Your notes… Type a reference like John 3:16 to link it.'}
            maxLength={max}
            rows={kind === 'verse' ? 6 : 14}
            aria-label="Note"
          />
          <p className="note-own-words">
            Write in your own words. Wording from the ESV, NASB, CSB or NKJV can’t be saved; “+ Verse text” adds the KJV or
            WEB wording, which can.
            {body.length > max * 0.8 && (
              <span className="note-count">
                {' '}
                {body.length.toLocaleString()} / {max.toLocaleString()}
              </span>
            )}
          </p>
        </>
      ) : (
        <div className="note-view" onDoubleClick={() => setEditing(true)}>
          {body.trim() ? <NoteText text={body} onOpenRef={onOpenRef} /> : <p className="muted">Nothing written yet.</p>}
        </div>
      )}

      {copies.length > 0 && (
        <div className="note-blocked" role="alert">
          <strong>Not saved: this note has wording from a licensed translation.</strong> The publishers don’t allow it to be
          stored. Choose what to put in its place:
          {copies.map((c, i) => (
            <div key={i} className="note-copy">
              <p className="note-copy-text">
                “{body.slice(c.start, Math.min(c.end, c.start + 90))}
                {c.end - c.start > 90 ? '…' : ''}” ({c.translation}, {c.label})
              </p>
              <div className="note-copy-actions">
                <button type="button" className="btn" onClick={() => replaceCopy(c, 'ref')}>
                  Use the reference
                </button>
                <button type="button" className="btn" onClick={() => replaceCopy(c, 'kjv')}>
                  KJV wording
                </button>
                <button type="button" className="btn" onClick={() => replaceCopy(c, 'web')}>
                  WEB wording
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {conflict && (
        <div className="note-blocked" role="alert">
          <strong>This note was changed on another device.</strong>
          <div className="note-copy-actions">
            <button type="button" className="btn" onClick={() => resolveConflict(false)}>
              Use the newer copy
            </button>
            <button type="button" className="btn" onClick={() => resolveConflict(true)}>
              Keep mine
            </button>
          </div>
        </div>
      )}
      {error && <p className="acct-error">{error}</p>}

      <div className="note-foot">
        {editing ? (
          <button
            type="button"
            className="btn primary"
            onClick={async () => {
              if (await save()) setEditing(false);
            }}
          >
            Done
          </button>
        ) : (
          <button type="button" className="btn" onClick={() => setEditing(true)}>
            Edit
          </button>
        )}
        <span className="note-status muted small" aria-live="polite">
          {statusText}
        </span>
        {(id || kind === 'page') && (
          <button type="button" className="acct-remove" onClick={remove}>
            Delete
          </button>
        )}
      </div>
    </div>
  );
}

/** "+ Verse text": puts in the KJV or WEB wording of a reference (public domain, so it may be saved). */
function InsertVerse({ defaultRef, onInsert }: { defaultRef: string; onInsert: (text: string) => void }) {
  const [ref, setRef] = useState(defaultRef);
  const [code, setCode] = useState<'kjv' | 'web'>('kjv');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const go = async () => {
    const r = findRefs(ref)[0];
    if (!r) return setError('Type a reference such as John 3:16 or Psalm 23.');
    const span = r.verse == null ? { ...r, verse: 1, toVerse: versesInChapter(r.osis, r.toChapter) } : r;
    if ((span.toChapter - span.chapter) * 40 + ((span.toVerse ?? 0) - (span.verse ?? 0)) > 40)
      return setError('Please choose a shorter passage (up to about 40 verses).');
    setBusy(true);
    setError(null);
    try {
      const text = await publicDomainText(code, span);
      onInsert(`> ${text}\n> — ${spanLabel(span)} (${code.toUpperCase()})`);
    } catch {
      setError('Couldn’t load that passage right now.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="note-insert">
      <input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="e.g. John 3:16-17" aria-label="Reference" />
      <select value={code} onChange={(e) => setCode(e.target.value as 'kjv' | 'web')} aria-label="Translation">
        <option value="kjv">KJV</option>
        <option value="web">WEB</option>
      </select>
      <button type="button" className="btn" onClick={go} disabled={busy}>
        {busy ? '…' : 'Insert'}
      </button>
      {error && <span className="acct-error small">{error}</span>}
    </div>
  );
}
