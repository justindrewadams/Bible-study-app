/**
 * Notes on verses and notebook pages (notebook → folder → page), kept in memory while signed in.
 * They are stored encrypted by the account service (accounts/src/notes.ts) and never kept on the device
 * between visits. Everything is forgotten on sign-out.
 */
import { useSyncExternalStore } from 'react';
import { AccountError, api, getAccount, onAccountChange } from './account';
import { findRefs, spanCovers, spanFromOsis, type Span } from './refs';

export interface Notebook {
  id: string;
  /** null for a notebook; its notebook's id for a folder */
  parentId: string | null;
  name: string;
  position: number;
  createdAt: number;
}

/** A stop of your own journey, or an item of your own list (the same fields as the built-in ones). */
export interface MyStop {
  ref: string;
  note: string;
  place?: string;
  lat?: number;
  lon?: number;
  placeIndex?: number | null;
  sea?: boolean;
  day?: string;
  event?: string;
  via?: [number, number][];
  /** list items: the name, and words to bold in the verse */
  t?: string;
  meta?: string;
  words?: string[];
}

export interface Note {
  id: string;
  kind: 'verse' | 'page' | 'journey' | 'list';
  notebookId: string | null;
  version: number;
  createdAt: number;
  updatedAt: number;
  /** verse notes: first verse, e.g. "John.3.16", and optional last verse */
  ref?: string;
  end?: string;
  /** pages */
  title?: string;
  date?: string;
  passages?: string[];
  body: string;
  /** your own journeys and lists */
  color?: string;
  summary?: string;
  /** the built-in journey or list this is a copy of */
  from?: string;
  stops?: MyStop[];
  items?: MyStop[];
}

export const VERSE_NOTE_MAX = 5000;
export const PAGE_MAX = 20000;

interface State {
  status: 'idle' | 'loading' | 'ready' | 'error';
  notebooks: Notebook[];
  notes: Note[];
}

let state: State = { status: 'idle', notebooks: [], notes: [] };
const listeners = new Set<() => void>();
const emit = (next: Partial<State>) => {
  state = { ...state, ...next };
  listeners.forEach((l) => l());
};

export function useNotes(): State {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
  );
}

export const getNotes = () => state;

/** Be told whenever notes change (used to keep your own journeys and lists in the menus). */
export function onNotesChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// forget everything when the person signs out
onAccountChange(() => {
  if (getAccount().status !== 'signed-in' && state.status !== 'idle') emit({ status: 'idle', notebooks: [], notes: [] });
});

let loading: Promise<void> | null = null;
/** Load every notebook and note (in batches of 100). Safe to call often. */
export function loadNotes(force = false): Promise<void> {
  if (getAccount().status !== 'signed-in') return Promise.resolve();
  if (state.status === 'ready' && !force) return Promise.resolve();
  if (loading) return loading;
  if (state.status !== 'ready') emit({ status: 'loading' });
  loading = (async () => {
    try {
      const { notebooks } = await api<{ notebooks: Notebook[] }>('/notebooks');
      const notes: Note[] = [];
      let after = '';
      for (let i = 0; i < 40; i++) {
        const r = await api<{ notes: Note[]; next: string | null }>(`/notes${after ? `?after=${encodeURIComponent(after)}` : ''}`);
        notes.push(...r.notes);
        if (!r.next) break;
        after = r.next;
      }
      emit({ status: 'ready', notebooks, notes });
    } catch {
      emit({ status: state.status === 'ready' ? 'ready' : 'error' });
    } finally {
      loading = null;
    }
  })();
  return loading;
}

export class NoteConflict extends Error {
  constructor(public latest: Note) {
    super('This note was changed on another device.');
  }
}

export type NoteDraft = Omit<Note, 'id' | 'version' | 'createdAt' | 'updatedAt'> & { id?: string; version?: number };

/** Save a note or page; returns the saved copy. A newer copy saved elsewhere raises NoteConflict. */
export async function saveNote(d: NoteDraft): Promise<Note> {
  const note =
    d.kind === 'verse'
      ? { ref: d.ref, end: d.end, body: d.body }
      : d.kind === 'page'
        ? { title: d.title ?? '', date: d.date, passages: d.passages ?? [], body: d.body }
        : {
            title: d.title ?? '',
            color: d.color,
            summary: d.summary ?? '',
            from: d.from,
            ...(d.kind === 'journey' ? { stops: d.stops ?? [] } : { items: d.items ?? [] }),
            body: '',
          };
  try {
    const r = await api<{ id: string; version: number; updatedAt: number; createdAt?: number }>('/notes/save', {
      id: d.id,
      version: d.version,
      kind: d.kind,
      notebookId: d.notebookId,
      note,
    });
    const old = state.notes.find((n) => n.id === r.id);
    const saved: Note = {
      ...(old ?? { createdAt: r.createdAt ?? r.updatedAt }),
      ...d,
      ...note,
      id: r.id,
      version: r.version,
      updatedAt: r.updatedAt,
    } as Note;
    emit({ notes: old ? state.notes.map((n) => (n.id === r.id ? saved : n)) : [...state.notes, saved] });
    return saved;
  } catch (e) {
    if (e instanceof AccountError && e.code === 'conflict' && e.body?.latest) {
      const latest = e.body.latest as Note;
      emit({ notes: state.notes.map((n) => (n.id === latest.id ? latest : n)) });
      throw new NoteConflict(latest);
    }
    if (e instanceof AccountError && e.code === 'gone' && d.id) emit({ notes: state.notes.filter((n) => n.id !== d.id) });
    throw e;
  }
}

export async function deleteNote(id: string) {
  await api('/notes/delete', { id });
  emit({ notes: state.notes.filter((n) => n.id !== id) });
}

export async function saveNotebook(b: { id?: string; name: string; parentId?: string | null }): Promise<string> {
  const r = await api<{ id: string }>('/notebooks/save', b);
  if (b.id) emit({ notebooks: state.notebooks.map((x) => (x.id === b.id ? { ...x, name: b.name } : x)) });
  else {
    const siblings = state.notebooks.filter((x) => x.parentId === (b.parentId ?? null));
    emit({
      notebooks: [
        ...state.notebooks,
        { id: r.id, name: b.name, parentId: b.parentId ?? null, position: siblings.length, createdAt: Date.now() / 1000 },
      ],
    });
  }
  return r.id;
}

/** Delete a notebook or folder. With pages still in it, `withPages` must be true. */
export async function deleteNotebook(id: string, withPages: boolean) {
  await api('/notebooks/delete', { id, withPages });
  const gone = new Set([id, ...state.notebooks.filter((b) => b.parentId === id).map((b) => b.id)]);
  emit({
    notebooks: state.notebooks.filter((b) => !gone.has(b.id)),
    notes: state.notes.filter((n) => !n.notebookId || !gone.has(n.notebookId)),
  });
}

export async function orderNotebooks(ids: string[]) {
  emit({ notebooks: state.notebooks.map((b) => (ids.includes(b.id) ? { ...b, position: ids.indexOf(b.id) } : b)) });
  await api('/notebooks/order', { ids });
}

// ----------------------------------------------------------------------------------- lookups

export const byPosition = (a: Notebook, b: Notebook) => a.position - b.position || a.createdAt - b.createdAt;

export function notebooksOf(parentId: string | null, all = state.notebooks): Notebook[] {
  return all.filter((b) => b.parentId === parentId).sort(byPosition);
}

/** Pages directly in a notebook or folder; for a notebook, `deep` also includes its folders' pages. */
export function pagesIn(id: string, deep = false, s: State = state): Note[] {
  const ids = new Set([id, ...(deep ? s.notebooks.filter((b) => b.parentId === id).map((b) => b.id) : [])]);
  return s.notes.filter((n) => n.kind === 'page' && n.notebookId && ids.has(n.notebookId));
}

/** "Sunday sermons › 2026" */
export function placeName(notebookId: string | null, s: State = state): string {
  if (!notebookId) return '';
  const b = s.notebooks.find((x) => x.id === notebookId);
  if (!b) return '';
  const parent = b.parentId ? s.notebooks.find((x) => x.id === b.parentId) : null;
  return parent ? `${parent.name} › ${b.name}` : b.name;
}

/** The verses a verse note is on. */
export function noteSpan(n: Note): Span | null {
  if (n.kind !== 'verse' || !n.ref) return null;
  const a = spanFromOsis(n.ref);
  if (!a) return null;
  const b = n.end ? spanFromOsis(n.end) : null;
  return b ? { ...a, toChapter: b.chapter, toVerse: b.verse } : a;
}

/** Verse notes that include this verse. */
export function verseNotesAt(osis: string, chapter: number, verse: number, s: State = state): Note[] {
  return s.notes.filter((n) => {
    const sp = noteSpan(n);
    return !!sp && spanCovers(sp, osis, chapter, verse);
  });
}

/** Spans a page mentions: its passages and every reference in its writing. */
const spanCache = new WeakMap<Note, Span[]>();
export function pageSpans(n: Note): Span[] {
  let s = spanCache.get(n);
  if (!s) {
    s = [
      ...(n.passages ?? []).map(spanFromOsis).filter((x): x is Span => !!x),
      ...findRefs(n.body).map(({ osis, chapter, verse, toChapter, toVerse }) => ({ osis, chapter, verse, toChapter, toVerse })),
    ];
    spanCache.set(n, s);
  }
  return s;
}

/** Notebook pages that mention this verse (a chapter reference counts for every verse in it). */
export function pagesMentioning(osis: string, chapter: number, verse: number, s: State = state): Note[] {
  return s.notes.filter((n) => n.kind === 'page' && pageSpans(n).some((sp) => spanCovers(sp, osis, chapter, verse)));
}

/** Verses in a chapter that start a verse note (for the small ✎ mark in the reader). */
export function noteMarks(osis: string, chapter: number, s: State = state): Set<number> {
  const out = new Set<number>();
  for (const n of s.notes) {
    const sp = noteSpan(n);
    if (sp && sp.osis === osis && sp.chapter === chapter && sp.verse != null) out.add(sp.verse);
  }
  return out;
}

export const myJourneyNotes = (s: State = state) =>
  s.notes.filter((n) => n.kind === 'journey').sort((a, b) => (a.title ?? '').localeCompare(b.title ?? ''));
export const myListNotes = (s: State = state) =>
  s.notes.filter((n) => n.kind === 'list').sort((a, b) => (a.title ?? '').localeCompare(b.title ?? ''));

/** Simple search over titles, writing and notebook names. */
export function searchNotes(q: string, s: State = state): Note[] {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  return s.notes
    .filter((n) => {
      const stops = [...(n.stops ?? []), ...(n.items ?? [])].map((x) => `${x.t ?? ''} ${x.place ?? ''} ${x.note}`).join('\n');
      const hay = `${n.title ?? ''}\n${n.summary ?? ''}\n${n.body}\n${stops}\n${placeName(n.notebookId, s)}`.toLowerCase();
      return words.every((w) => hay.includes(w));
    })
    .sort((a, b) => b.updatedAt - a.updatedAt);
}
