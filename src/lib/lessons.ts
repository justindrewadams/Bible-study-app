/**
 * Class lessons: sharing by link, opening a shared lesson, and turning a lesson's steps into places to go
 * in the app. A lesson is stored as a note of kind "lesson" (see notes.ts); sharing gives it a random link
 * code (accounts/src/lessons.ts). Links carry only that code, never Bible wording.
 */
import { useSyncExternalStore } from 'react';
import { api, getAccount } from './account';
import { setSharedJourneys, type Journey } from './journeys';
import { setSharedLists, type StudyList } from './lists';
import { noteToJourney, noteToList } from './mine';
import { saveNote, type LessonStep, type Note } from './notes';

export interface ShareInfo {
  shareId: string;
  noteId: string;
  showName: boolean;
}

interface State {
  shares: ShareInfo[];
  loaded: boolean;
}
let state: State = { shares: [], loaded: false };
const listeners = new Set<() => void>();
const emit = (s: Partial<State>) => {
  state = { ...state, ...s };
  listeners.forEach((l) => l());
};
export function useShares(): State {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
  );
}

export async function loadShares() {
  if (getAccount().status !== 'signed-in') return;
  try {
    const r = await api<{ shares: ShareInfo[] }>('/lessons/shares');
    emit({ shares: r.shares, loaded: true });
  } catch {
    /* shown as not shared */
  }
}

export async function shareLesson(noteId: string, showName: boolean): Promise<ShareInfo> {
  const r = await api<{ shareId: string; showName: boolean }>('/lessons/share', { noteId, showName });
  const info = { shareId: r.shareId, noteId, showName: r.showName };
  emit({ shares: [...state.shares.filter((s) => s.noteId !== noteId), info] });
  return info;
}

export async function unshareLesson(noteId: string) {
  await api('/lessons/unshare', { noteId });
  emit({ shares: state.shares.filter((s) => s.noteId !== noteId) });
}

export const shareUrl = (shareId: string) => `${window.location.origin}${window.location.pathname}#lesson/${shareId}`;

/** A lesson as the player shows it: yours, or one shared with you by link. */
export interface OpenLesson {
  kind: 'mine' | 'shared';
  /** your note id, or the share code */
  id: string;
  title: string;
  summary: string;
  steps: LessonStep[];
  author: string | null;
}

interface SharedAnswer {
  id: string;
  title: string;
  summary: string;
  steps: LessonStep[];
  author: string | null;
  extras: (Note & { id: string; kind: 'journey' | 'list' })[];
}

let lastShared: SharedAnswer | null = null;

/** Open a shared lesson (no account needed). Its own journeys and lists are made available to follow. */
export async function loadSharedLesson(shareId: string): Promise<OpenLesson> {
  const r = await api<SharedAnswer>(`/shared?id=${encodeURIComponent(shareId)}`);
  lastShared = r;
  const journeys: Journey[] = [];
  const lists: StudyList[] = [];
  for (const x of r.extras ?? []) {
    const n = { ...x, version: 0, createdAt: 0, updatedAt: 0, notebookId: null, body: '' } as Note;
    if (x.kind === 'journey') {
      const j = noteToJourney(n);
      if (j) journeys.push({ ...j, id: `shared:${x.id}`, era: 'From a shared lesson' });
    } else {
      const l = noteToList(n);
      if (l) lists.push({ ...l, id: `shared:${x.id}` });
    }
  }
  setSharedJourneys(journeys);
  setSharedLists(lists);
  return { kind: 'shared', id: r.id, title: r.title, summary: r.summary, steps: r.steps, author: r.author };
}

export function closeSharedLesson() {
  setSharedJourneys([]);
  setSharedLists([]);
}

/** The journey/list id a step points at, as the app knows it. */
export function stepTargetId(step: LessonStep, lesson: OpenLesson): string | null {
  if (!step.id) return null;
  if (step.source === 'builtin') return step.id;
  return lesson.kind === 'shared' ? `shared:${step.id}` : `my:${step.id}`;
}

/** "Save a copy" of a shared lesson to your own My Content (with copies of its own journeys and lists). */
export async function saveSharedCopy(): Promise<Note> {
  const r = lastShared;
  if (!r) throw new Error('Open the lesson again, then try once more.');
  const newIds = new Map<string, string>();
  for (const x of r.extras ?? []) {
    const n = await saveNote({
      kind: x.kind,
      notebookId: null,
      title: x.title ?? '',
      color: x.color,
      summary: x.summary ?? '',
      ...(x.kind === 'journey' ? { stops: x.stops ?? [] } : { items: x.items ?? [] }),
      body: '',
    });
    newIds.set(x.id, n.id);
  }
  const steps = r.steps.map((s) => (s.source === 'mine' && s.id && newIds.has(s.id) ? { ...s, id: newIds.get(s.id)! } : s));
  return saveNote({ kind: 'lesson', notebookId: null, title: `${r.title} (copy)`, summary: r.summary, steps, body: '' });
}
