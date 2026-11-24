/**
 * The My Content page (#notes): notebooks → folders → pages, all verse notes, your own journeys and lists,
 * and search. (Called "Notes" in the code and the address; the owner renamed the page "My Content".)
 *   #notes              start (on phones: the list of notebooks)
 *   #notes/nb/<id>      a notebook or folder
 *   #notes/page/<id>    a page
 *   #notes/verse        every verse note, in Bible order
 * Computers show the notebooks beside the page; phones show one level at a time.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  byPosition,
  deleteNotebook,
  loadNotes,
  noteSpan,
  notebooksOf,
  orderNotebooks,
  pagesIn,
  placeName,
  saveNotebook,
  searchNotes,
  useNotes,
  type Note,
  type NoteDraft,
} from '../lib/notes';
import { bookIndex, spanFromOsis, spanLabel, type Span } from '../lib/refs';
import NoteEditor from './NoteEditor';
import MineEditor from './MineEditor';
import { myLessonNotes, myListNotes, myJourneyNotes, saveNote as saveMine } from '../lib/notes';
import LessonEditor from './LessonEditor';
import { useShares } from '../lib/lessons';
import { PALETTE } from '../lib/mine';
import { LESSONS_ENABLED, MINE_ENABLED } from '../config';

interface Props {
  route: string;
  onClose: () => void;
  onOpenRef: (s: Span) => void;
  signedIn: boolean;
  onSignIn: () => void;
  /** follow your own journey / study your own list in the reader */
  onFollowMine: (kind: 'journey' | 'list', noteId: string) => void;
  /** start one of your lessons in the reader */
  onStartLesson: (noteId: string) => void;
}

const go = (h: string) => {
  window.location.hash = h;
};

const pageOrder = (a: Note, b: Note) => (b.date ?? '').localeCompare(a.date ?? '') || b.updatedAt - a.updatedAt;
const when = (n: Note) =>
  n.date ? new Date(n.date + 'T12:00').toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '';
const snippet = (body: string) =>
  body
    .replace(/[*_#>]+/g, '')
    .replace(/^\s*(?:[-•]|\d+[.)])\s+/gm, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);

export default function NotesPage({ route, onClose, onOpenRef, signedIn, onSignIn, onFollowMine, onStartLesson }: Props) {
  const { shares } = useShares();
  const store = useNotes();
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState<NoteDraft | null>(null);
  const [openVerseNote, setOpenVerseNote] = useState<string | null>(null);
  const parts = route.split('/'); // ["#notes", "nb", id]
  const view = parts[1] ?? '';
  const id = parts[2] ?? '';

  useEffect(() => {
    if (signedIn) loadNotes();
  }, [signedIn]);
  useEffect(() => setCreating(null), [route]);

  const notebook = view === 'nb' ? store.notebooks.find((b) => b.id === id) : undefined;
  const page = view === 'page' ? store.notes.find((n) => n.id === id) : undefined;
  const mine = view === 'journey' || view === 'list' ? store.notes.find((n) => n.id === id && n.kind === view) : undefined;
  const lessonNote = view === 'lesson' ? store.notes.find((n) => n.id === id && n.kind === 'lesson') : undefined;
  const newLesson = async () => {
    try {
      const n = await saveMine({ kind: 'lesson', notebookId: null, title: 'My lesson', summary: '', steps: [], body: '' });
      go(`notes/lesson/${n.id}`);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Couldn’t create it.');
    }
  };
  const newMine = async (kind: 'journey' | 'list') => {
    try {
      const n = await saveMine({
        kind,
        notebookId: null,
        title: kind === 'journey' ? 'My journey' : 'My list',
        color: PALETTE[(myJourneyNotes(store).length + myListNotes(store).length) % PALETTE.length],
        summary: '',
        ...(kind === 'journey' ? { stops: [] } : { items: [] }),
        body: '',
      });
      go(`notes/${kind}/${n.id}`);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Couldn’t create it.');
    }
  };
  const results = useMemo(() => (query.trim() ? searchNotes(query, store) : []), [query, store]);
  const verseNotes = useMemo(
    () =>
      store.notes
        .filter((n) => n.kind === 'verse')
        .sort((a, b) => {
          const x = noteSpan(a);
          const y = noteSpan(b);
          return bookIndex(x?.osis ?? '') - bookIndex(y?.osis ?? '') || (x?.chapter ?? 0) - (y?.chapter ?? 0) || (x?.verse ?? 0) - (y?.verse ?? 0);
        }),
    [store.notes],
  );

  const newNotebook = async (parentId: string | null) => {
    const name = prompt(parentId ? 'Name for the new folder (e.g. 2026, or a series):' : 'Name for the new notebook (e.g. Sunday sermons):');
    if (!name?.trim()) return;
    try {
      const nid = await saveNotebook({ name: name.trim(), parentId });
      go(`notes/nb/${nid}`);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Couldn’t create it.');
    }
  };
  const rename = async (b: { id: string; name: string }) => {
    const name = prompt('New name:', b.name);
    if (!name?.trim() || name.trim() === b.name) return;
    try {
      await saveNotebook({ id: b.id, name: name.trim() });
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Couldn’t rename it.');
    }
  };
  const remove = async (b: { id: string; name: string; parentId: string | null }) => {
    const count = pagesIn(b.id, true, store).length;
    const what = b.parentId ? 'folder' : 'notebook';
    const msg = count
      ? `Delete the ${what} “${b.name}” and the ${count} page${count === 1 ? '' : 's'} in it? This can’t be undone.`
      : `Delete the ${what} “${b.name}”?`;
    if (!confirm(msg)) return;
    try {
      await deleteNotebook(b.id, true);
      go(b.parentId ? `notes/nb/${b.parentId}` : 'notes');
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Couldn’t delete it.');
    }
  };
  const move = async (b: { id: string; parentId: string | null }, d: number) => {
    const sibs = notebooksOf(b.parentId, store.notebooks);
    const i = sibs.findIndex((x) => x.id === b.id);
    const j = i + d;
    if (j < 0 || j >= sibs.length) return;
    const ids = sibs.map((x) => x.id);
    [ids[i], ids[j]] = [ids[j], ids[i]];
    orderNotebooks(ids).catch(() => {});
  };
  const startPage = (notebookId: string | null) =>
    setCreating({ kind: 'page', notebookId, title: '', date: new Date().toISOString().slice(0, 10), passages: [], body: '' });

  // ------------------------------------------------------------------------------ the sidebar
  const tops = notebooksOf(null, store.notebooks);
  const sidebar = (
    <nav className="notes-side" aria-label="Notebooks">
      <input
        type="search"
        className="notes-search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search my content"
        aria-label="Search my content"
      />
      <button className={`notes-nav${view === 'verse' ? ' on' : ''}`} onClick={() => go('notes/verse')}>
        <span>Verse notes</span>
        <span className="notes-count">{verseNotes.length}</span>
      </button>
      <div className="notes-side-head">
        <span>Notebooks</span>
        <button className="link-button" onClick={() => newNotebook(null)}>
          + New
        </button>
      </div>
      {tops.length === 0 && store.status === 'ready' && <p className="muted small notes-empty-side">No notebooks yet.</p>}
      {tops.map((b) => {
        const open = notebook?.id === b.id || notebook?.parentId === b.id || (page?.notebookId && (page.notebookId === b.id || store.notebooks.find((f) => f.id === page.notebookId)?.parentId === b.id));
        return (
          <div key={b.id} className="notes-tree">
            <button className={`notes-nav${notebook?.id === b.id ? ' on' : ''}`} onClick={() => go(`notes/nb/${b.id}`)}>
              <span>{b.name}</span>
              <span className="notes-count">{pagesIn(b.id, true, store).length}</span>
            </button>
            {open &&
              notebooksOf(b.id, store.notebooks).map((f) => (
                <button key={f.id} className={`notes-nav folder${notebook?.id === f.id ? ' on' : ''}`} onClick={() => go(`notes/nb/${f.id}`)}>
                  <span>{f.name}</span>
                  <span className="notes-count">{pagesIn(f.id, false, store).length}</span>
                </button>
              ))}
          </div>
        );
      })}
      {LESSONS_ENABLED && (
        <div className="notes-mine">
          <div className="notes-side-head">
            <span>My lessons</span>
            <button className="link-button" onClick={newLesson}>
              + New
            </button>
          </div>
          {myLessonNotes(store).length === 0 && store.status === 'ready' && (
            <p className="muted small notes-empty-side">None yet. A lesson is a series of steps you can present or share.</p>
          )}
          {myLessonNotes(store).map((n) => (
            <button key={n.id} className={`notes-nav${lessonNote?.id === n.id ? ' on' : ''}`} onClick={() => go(`notes/lesson/${n.id}`)}>
              <span>
                {n.title || 'My lesson'}
                {shares.some((s) => s.noteId === n.id) && <span className="lesson-shared-mark" title="Shared by link"> · shared</span>}
              </span>
              <span className="notes-count">{n.steps?.length ?? 0}</span>
            </button>
          ))}
        </div>
      )}
      {(MINE_ENABLED ? (['journey', 'list'] as const) : []).map((kind) => {
        const items = kind === 'journey' ? myJourneyNotes(store) : myListNotes(store);
        return (
          <div key={kind} className="notes-mine">
            <div className="notes-side-head">
              <span>{kind === 'journey' ? 'My journeys' : 'My lists'}</span>
              <button className="link-button" onClick={() => newMine(kind)}>
                + New
              </button>
            </div>
            {items.length === 0 && store.status === 'ready' && (
              <p className="muted small notes-empty-side">
                {kind === 'journey' ? 'None yet. Or open a journey and choose “Make my own copy”.' : 'None yet.'}
              </p>
            )}
            {items.map((n) => (
              <button
                key={n.id}
                className={`notes-nav${mine?.id === n.id ? ' on' : ''}`}
                onClick={() => go(`notes/${kind}/${n.id}`)}
                style={{ '--c': n.color } as React.CSSProperties}
              >
                <span>
                  <span className="mine-dot" aria-hidden />
                  {n.title || (kind === 'journey' ? 'My journey' : 'My list')}
                </span>
                <span className="notes-count">{(kind === 'journey' ? n.stops : n.items)?.length ?? 0}</span>
              </button>
            ))}
          </div>
        );
      })}
    </nav>
  );

  const pageList = (list: Note[]) =>
    list.length === 0 ? (
      <p className="muted small">No pages yet.</p>
    ) : (
      <ul className="notes-list">
        {[...list].sort(pageOrder).map((p) => (
          <li key={p.id}>
            <button className="notes-row" onClick={() => go(`notes/page/${p.id}`)}>
              <span className="notes-row-title">{p.title || 'Untitled page'}</span>
              <span className="notes-row-meta muted small">
                {[when(p), ...(p.passages ?? []).slice(0, 2).map((x) => {
                  const sp = spanFromOsis(x);
                  return sp ? spanLabel(sp) : '';
                })].filter(Boolean).join(' · ')}
              </span>
              {p.body && <span className="notes-row-snip muted small">{snippet(p.body)}</span>}
            </button>
          </li>
        ))}
      </ul>
    );

  // --------------------------------------------------------------------------------- the main view
  let main: JSX.Element;
  if (!signedIn) {
    main = (
      <div className="notes-welcome">
        <h2>My Content</h2>
        <p>
          Sign in to write notes on verses, keep notebooks for sermons and classes, and make your own journeys and lists.
          They follow you to all your devices.
        </p>
        <button className="btn primary" onClick={onSignIn}>
          Sign in or create an account
        </button>
      </div>
    );
  } else if (creating) {
    main = (
      <div className="notes-pageview">
        <p className="notes-crumbs muted small">{placeName(creating.notebookId, store) || 'New page'}</p>
        <NoteEditor
          key="creating"
          note={creating}
          editing
          onOpenRef={onOpenRef}
          onSaved={(n) => history.replaceState(null, '', `#notes/page/${n.id}`)}
          onDeleted={() => setCreating(null)}
        />
      </div>
    );
  } else if (query.trim()) {
    main = (
      <div>
        <h2 className="notes-h">
          {results.length} result{results.length === 1 ? '' : 's'} for “{query.trim()}”
        </h2>
        <ul className="notes-list">
          {results.map((n) => {
            const sp = noteSpan(n);
            return (
              <li key={n.id}>
                <button
                  className="notes-row"
                  onClick={() => {
                    setQuery('');
                    if (n.kind === 'page') go(`notes/page/${n.id}`);
                    else if (n.kind === 'journey' || n.kind === 'list' || n.kind === 'lesson') go(`notes/${n.kind}/${n.id}`);
                    else {
                      setOpenVerseNote(n.id);
                      go('notes/verse');
                    }
                  }}
                >
                  <span className="notes-row-title">
                    {n.kind === 'verse' ? (sp ? spanLabel(sp) : 'Verse note') : n.title || 'Untitled'}
                  </span>
                  <span className="notes-row-meta muted small">
                    {n.kind === 'journey' ? 'My journey' : n.kind === 'list' ? 'My list' : n.kind === 'lesson' ? 'My lesson' : placeName(n.notebookId, store) || (n.kind === 'verse' ? 'Verse note' : '')}
                  </span>
                  <span className="notes-row-snip muted small">{snippet(n.kind === 'journey' || n.kind === 'list' || n.kind === 'lesson' ? n.summary ?? '' : n.body)}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    );
  } else if (lessonNote) {
    main = (
      <div className="notes-pageview">
        <p className="notes-crumbs muted small">My lessons</p>
        <LessonEditor key={lessonNote.id} note={lessonNote} onStart={onStartLesson} onOpenRef={onOpenRef} onDeleted={() => go('notes')} />
      </div>
    );
  } else if (mine) {
    main = (
      <div className="notes-pageview">
        <p className="notes-crumbs muted small">{mine.kind === 'journey' ? 'My journeys' : 'My lists'}</p>
        <MineEditor
          key={mine.id}
          note={mine}
          onOpenRef={onOpenRef}
          onFollow={(nid) => onFollowMine(mine.kind as 'journey' | 'list', nid)}
          onDeleted={() => go('notes')}
        />
      </div>
    );
  } else if (view === 'page' && page) {
    const nb = store.notebooks.find((b) => b.id === page.notebookId);
    main = (
      <div className="notes-pageview">
        <p className="notes-crumbs small">
          {nb ? (
            <button className="link-button" onClick={() => go(`notes/nb/${nb.id}`)}>
              ‹ {placeName(nb.id, store)}
            </button>
          ) : (
            <span className="muted">Not in a notebook</span>
          )}
        </p>
        <NoteEditor key={page.id} note={page} onOpenRef={onOpenRef} onDeleted={() => go(nb ? `notes/nb/${nb.id}` : 'notes')} />
      </div>
    );
  } else if (view === 'nb' && notebook) {
    const isFolder = !!notebook.parentId;
    const parent = isFolder ? store.notebooks.find((b) => b.id === notebook.parentId) : null;
    const folders = isFolder ? [] : notebooksOf(notebook.id, store.notebooks);
    main = (
      <div>
        {parent && (
          <p className="notes-crumbs small">
            <button className="link-button" onClick={() => go(`notes/nb/${parent.id}`)}>
              ‹ {parent.name}
            </button>
          </p>
        )}
        <div className="notes-headrow">
          <h2 className="notes-h">{notebook.name}</h2>
          <div className="notes-actions">
            <button className="btn primary" onClick={() => startPage(notebook.id)}>
              + New page
            </button>
            {!isFolder && (
              <button className="btn" onClick={() => newNotebook(notebook.id)}>
                + New folder
              </button>
            )}
          </div>
        </div>
        <div className="notes-manage small">
          <button className="link-button" onClick={() => rename(notebook)}>
            Rename
          </button>
          <button className="link-button wide-only" onClick={() => move(notebook, -1)}>
            Move up
          </button>
          <button className="link-button wide-only" onClick={() => move(notebook, 1)}>
            Move down
          </button>
          <button className="link-button notes-danger" onClick={() => remove(notebook)}>
            Delete
          </button>
        </div>
        {folders.length > 0 && (
          <ul className="notes-list notes-folders">
            {[...folders].sort(byPosition).map((f) => (
              <li key={f.id}>
                <button className="notes-row folder" onClick={() => go(`notes/nb/${f.id}`)}>
                  <span className="notes-row-title">▸ {f.name}</span>
                  <span className="notes-row-meta muted small">
                    {pagesIn(f.id, false, store).length} page{pagesIn(f.id, false, store).length === 1 ? '' : 's'}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {pagesIn(notebook.id, false, store).length > 0 || folders.length === 0 ? pageList(pagesIn(notebook.id, false, store)) : null}
      </div>
    );
  } else if (view === 'verse') {
    main = (
      <div>
        <h2 className="notes-h">Verse notes</h2>
        {verseNotes.length === 0 ? (
          <p className="muted">Select a verse while reading and tap “✎ Note” to write one.</p>
        ) : (
          <ul className="notes-list">
            {verseNotes.map((n) => {
              const sp = noteSpan(n);
              const open = openVerseNote === n.id;
              return (
                <li key={n.id} className={open ? 'open' : undefined}>
                  {open ? (
                    <div className="notes-verse-open">
                      <div className="vn-head">
                        <button className="link-button vn-ref" onClick={() => sp && onOpenRef(sp)}>
                          {sp ? spanLabel(sp) : ''}
                        </button>
                        <button className="acct-remove" onClick={() => setOpenVerseNote(null)}>
                          Close
                        </button>
                      </div>
                      <NoteEditor note={n} onOpenRef={onOpenRef} onDeleted={() => setOpenVerseNote(null)} />
                    </div>
                  ) : (
                    <button className="notes-row" onClick={() => setOpenVerseNote(n.id)}>
                      <span className="notes-row-title">{sp ? spanLabel(sp) : 'Verse note'}</span>
                      {n.notebookId && <span className="notes-row-meta muted small">{placeName(n.notebookId, store)}</span>}
                      <span className="notes-row-snip muted small">{snippet(n.body)}</span>
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    );
  } else {
    const recent = store.notes.filter((n) => n.kind === 'page').sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 8);
    main =
      store.status === 'loading' ? (
        <p className="muted">Loading your notes…</p>
      ) : store.status === 'error' ? (
        <p className="acct-error">Couldn’t load your notes. Check your connection and try again.</p>
      ) : tops.length === 0 ? (
        <div className="notes-welcome">
          <h2>Start a notebook</h2>
          <p>Notebooks keep sermon and class notes together. Inside a notebook you can make folders (a year, or a series) and pages.</p>
          <div className="notes-actions">
            {['Sunday sermons', 'Class notes', 'Personal study'].map((n) => (
              <button
                key={n}
                className="btn"
                onClick={async () => {
                  try {
                    go(`notes/nb/${await saveNotebook({ name: n, parentId: null })}`);
                  } catch (e) {
                    alert(e instanceof Error ? e.message : 'Couldn’t create it.');
                  }
                }}
              >
                + {n}
              </button>
            ))}
            <button className="btn" onClick={() => newNotebook(null)}>
              + Other…
            </button>
          </div>
        </div>
      ) : (
        <div>
          <h2 className="notes-h">Recent pages</h2>
          {pageList(recent)}
        </div>
      );
  }

  // on phones the notebook list (with the search box) shows only at the start
  const atStart = !view && !creating;
  return (
    <div className={`periods-page notes-page${atStart ? ' at-start' : ''}`}>
      <div className="periods-bar">
        <button className="bar-back" onClick={atStart || !signedIn ? onClose : () => go('notes')}>
          {atStart || !signedIn ? '‹ Back to reading' : '‹ My Content'}
        </button>
        <span className="bar-title">My Content</span>
      </div>
      <div className="notes-layout">
        {signedIn && sidebar}
        <main className="notes-main">{main}</main>
      </div>
    </div>
  );
}
