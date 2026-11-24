/**
 * Your own journeys and study lists, turned into the same shapes as the built-in ones, so the map, the
 * journey and list panels, Roman-road routes and presenting all work with them unchanged. Kept in step
 * with your notes (they are stored there, kinds "journey" and "list"); ids start with "my:".
 */
import { JOURNEYS, setMyJourneys, type Journey, type Stop } from './journeys';
import { LISTS, setMyLists, type ListItem, type StudyList } from './lists';
import { onNotesChange, getNotes, saveNote, type MyStop, type Note } from './notes';

export const myId = (noteId: string) => `my:${noteId}`;
export const noteIdOf = (id: string) => id.replace(/^my:/, '');

export function noteToJourney(n: Note): Journey | null {
  const stops: Stop[] = (n.stops ?? [])
    .filter((s) => s.lat != null && s.lon != null)
    .map((s) => ({
      place: s.place ?? 'A spot on the map',
      ref: s.ref,
      note: s.note ?? '',
      lat: s.lat!,
      lon: s.lon!,
      placeIndex: s.placeIndex ?? null,
      ...(s.via ? { via: s.via } : {}),
      ...(s.sea ? { sea: true } : {}),
      ...(s.day ? { day: s.day } : {}),
      ...(s.event ? { event: s.event } : {}),
    }));
  if (!stops.length) return null;
  return { id: myId(n.id), title: n.title || 'My journey', era: 'My journey', color: n.color ?? '#1971c2', summary: n.summary ?? '', stops };
}

export function noteToList(n: Note): StudyList | null {
  const items: ListItem[] = (n.items ?? []).map((s) => ({
    t: s.t ?? s.ref,
    ref: s.ref,
    ...(s.note ? { note: s.note } : {}),
    ...(s.meta ? { meta: s.meta } : {}),
    ...(s.words?.length ? { words: s.words } : {}),
    ...(s.place ? { place: s.place } : {}),
    ...(s.lat != null && s.lon != null ? { lat: s.lat, lon: s.lon } : {}),
    ...(s.placeIndex != null ? { placeIndex: s.placeIndex } : {}),
  }));
  if (!items.length) return null;
  return { id: myId(n.id), title: n.title || 'My list', group: 'Whole Bible', color: n.color ?? '#1971c2', summary: n.summary ?? '', items };
}

let lastNotes: Note[] | null = null;
function sync() {
  const s = getNotes();
  if (s.notes === lastNotes) return;
  lastNotes = s.notes;
  setMyJourneys(s.notes.filter((n) => n.kind === 'journey').map(noteToJourney).filter((x): x is Journey => !!x));
  setMyLists(s.notes.filter((n) => n.kind === 'list').map(noteToList).filter((x): x is StudyList => !!x));
}
// registered before the app's own listeners, so menus and panels always see the newest copies
onNotesChange(sync);
sync();

export const PALETTE = ['#1971c2', '#c2255c', '#2f9e44', '#e67700', '#9c36b5', '#0c8599', '#d9480f', '#5c940d'];

/** "Make my own copy" of a built-in journey or list: saved straight away, so it can be edited. */
export async function copyBuiltIn(kind: 'journey' | 'list', id: string): Promise<Note> {
  if (kind === 'journey') {
    const j = JOURNEYS.find((x) => x.id === id);
    if (!j) throw new Error('That journey no longer exists.');
    const stops: MyStop[] = j.stops.map((s) => ({
      ref: s.ref,
      note: s.note,
      place: s.place,
      lat: s.lat,
      lon: s.lon,
      placeIndex: s.placeIndex,
      ...(s.via ? { via: s.via } : {}),
      ...(s.sea ? { sea: true } : {}),
      ...(s.day ? { day: s.day } : {}),
      ...(s.event ? { event: s.event } : {}),
    }));
    return saveNote({ kind: 'journey', notebookId: null, title: `${j.title} (my copy)`, color: j.color, summary: j.summary, from: j.id, stops, body: '' });
  }
  const l = LISTS.find((x) => x.id === id);
  if (!l) throw new Error('That list no longer exists.');
  const items: MyStop[] = l.items.map((it) => ({
    t: it.t,
    ref: it.ref,
    note: it.note ?? '',
    ...(it.meta ? { meta: it.meta } : {}),
    ...(it.words ? { words: it.words } : {}),
    ...(it.place ? { place: it.place } : {}),
    ...(it.lat != null && it.lon != null ? { lat: it.lat, lon: it.lon } : {}),
    ...(it.placeIndex != null ? { placeIndex: it.placeIndex } : {}),
  }));
  return saveNote({ kind: 'list', notebookId: null, title: `${l.title} (my copy)`, color: l.color, summary: l.summary, from: l.id, items, body: '' });
}
