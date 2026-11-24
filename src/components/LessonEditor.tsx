/**
 * Making a class lesson (in My Content): a title, a description and steps of seven kinds: a passage, your
 * notes, a map stop, a journey or list (yours or built-in, from a chosen stop), an app page (person, nation,
 * period, Jerusalem spot) and a web link. Saves as you type; licensed Bible wording is blocked as in notes.
 * The Share box gives a link anyone can open without an account (always the latest version).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SPOTS } from '../data/jerusalem';
import { NATIONS } from '../data/nations';
import { PERIODS } from '../data/periods';
import { allJourneys, JOURNEYS } from '../lib/journeys';
import { allLists, LISTS } from '../lib/lists';
import { findLicensedCopies, publicDomainText, type LicensedCopy } from '../lib/licenseGuard';
import { shareLesson, shareUrl, unshareLesson, useShares } from '../lib/lessons';
import { deleteNote, NoteConflict, saveNote, useNotes, type LessonStep, type Note } from '../lib/notes';
import { loadPeople, type PersonEntry } from '../lib/people';
import { parsePassages, spanFromOsis, spanLabel, spanToOsis, type Span } from '../lib/refs';
import { PlaceField, type Row } from './MineEditor';

interface Props {
  note: Note;
  onStart: (noteId: string) => void;
  onOpenRef: (s: Span) => void;
  onDeleted: () => void;
}

type Step = LessonStep & { k: number; refText?: string };
let keySeq = 0;
const withKeys = (steps: LessonStep[] | undefined): Step[] =>
  (steps ?? []).map((s) => ({ ...s, k: ++keySeq, refText: s.type === 'passage' && s.ref ? labelOf(s.ref) : undefined }));

function labelOf(osis: string) {
  const s = spanFromOsis(osis);
  return s ? spanLabel(s) : osis;
}

export const STEP_KINDS: { type: LessonStep['type']; label: string; hint: string }[] = [
  { type: 'passage', label: 'Passage', hint: 'Verses to read' },
  { type: 'note', label: 'Notes', hint: 'Your teaching notes' },
  { type: 'place', label: 'Map stop', hint: 'A place to show' },
  { type: 'journey', label: 'Journey', hint: 'Follow a journey from a stop' },
  { type: 'list', label: 'List', hint: 'A study list item' },
  { type: 'page', label: 'Page', hint: 'A person, nation, period or Jerusalem spot' },
  { type: 'link', label: 'Web link', hint: 'A video or article' },
];

/** A short line describing a step (used here and by the lesson player). */
export function stepSummary(s: LessonStep): string {
  switch (s.type) {
    case 'passage':
      return s.ref ? labelOf(s.ref) : 'Passage';
    case 'note':
      return s.title || s.note.split('\n').find((l) => l.trim())?.replace(/^[#>*\-\s]+/, '').slice(0, 60) || 'Notes';
    case 'place':
      return s.place || 'Map stop';
    case 'journey': {
      const j = allJourneys().find((x) => x.id === s.id || x.id === `my:${s.id}` || x.id === `shared:${s.id}`);
      return `${j?.title ?? 'Journey'}, stop ${(s.index ?? 0) + 1}`;
    }
    case 'list': {
      const l = allLists().find((x) => x.id === s.id || x.id === `my:${s.id}` || x.id === `shared:${s.id}`);
      return `${l?.title ?? 'List'}, item ${(s.index ?? 0) + 1}`;
    }
    case 'page':
      return s.label || 'Page';
    case 'link':
      try {
        return s.label || new URL(s.url ?? '').hostname;
      } catch {
        return 'Web link';
      }
  }
}

const complete = (s: Step) => {
  switch (s.type) {
    case 'passage':
      return !!s.ref;
    case 'note':
      return !!(s.note.trim() || s.title?.trim());
    case 'place':
      return s.lat != null && s.lon != null;
    case 'journey':
    case 'list':
      return !!s.id;
    case 'page':
      return !!s.pageType && !!s.id;
    case 'link':
      return /^https?:\/\/[^\s/]+\.[^\s]+/.test(s.url ?? '');
  }
};

export default function LessonEditor({ note, onStart, onOpenRef, onDeleted }: Props) {
  const [version, setVersion] = useState(note.version);
  const [title, setTitle] = useState(note.title ?? '');
  const [summary, setSummary] = useState(note.summary ?? '');
  const [steps, setSteps] = useState<Step[]>(() => withKeys(note.steps));
  const [open, setOpen] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const [status, setStatus] = useState<'saved' | 'unsaved' | 'saving' | 'blocked' | 'conflict' | 'error'>('saved');
  const [copies, setCopies] = useState<{ field: string; copy: LicensedCopy }[]>([]);
  const [conflict, setConflict] = useState<Note | null>(null);
  const [error, setError] = useState<string | null>(null);
  const dirty = useRef(false);

  const touch = () => {
    dirty.current = true;
    setStatus('unsaved');
  };

  const save = useCallback(async () => {
    if (!dirty.current) return true;
    setStatus('saving');
    const found: { field: string; copy: LicensedCopy }[] = [];
    for (const c of await findLicensedCopies(summary)) found.push({ field: 'summary', copy: c });
    for (const s of steps) for (const c of await findLicensedCopies(s.note)) found.push({ field: String(s.k), copy: c });
    if (found.length) {
      setCopies(found);
      setStatus('blocked');
      return false;
    }
    setCopies([]);
    const clean = steps.filter(complete).map(({ k: _k, refText: _r, ...s }) => s); // eslint-disable-line @typescript-eslint/no-unused-vars
    try {
      dirty.current = false;
      const saved = await saveNote({ id: note.id, version, kind: 'lesson', notebookId: null, title: title.trim(), summary, steps: clean, body: '' });
      setVersion(saved.version);
      setStatus('saved');
      setError(null);
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
  }, [steps, summary, title, version, note.id]);

  useEffect(() => {
    if (!dirty.current || status === 'conflict') return;
    const t = setTimeout(save, 1500);
    return () => clearTimeout(t);
  }, [steps, summary, title]); // eslint-disable-line react-hooks/exhaustive-deps
  const saveRef = useRef(save);
  saveRef.current = save;
  useEffect(() => () => void saveRef.current(), []);

  const setStep = (k: number, patch: Partial<Step>) => {
    touch();
    setSteps((ss) => ss.map((s) => (s.k === k ? { ...s, ...patch } : s)));
  };
  const move = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= steps.length) return;
    touch();
    setSteps((ss) => {
      const n = [...ss];
      [n[i], n[j]] = [n[j], n[i]];
      return n;
    });
  };
  const add = (type: LessonStep['type']) => {
    const s: Step = { k: ++keySeq, type, note: '', ...(type === 'journey' || type === 'list' ? { source: 'builtin', index: 0 } : {}) };
    touch();
    setSteps((ss) => [...ss, s]);
    setOpen(s.k);
    setAdding(false);
  };
  const remove = (k: number) => {
    touch();
    setSteps((ss) => ss.filter((s) => s.k !== k));
  };

  const replaceCopy = async (f: { field: string; copy: LicensedCopy }, how: 'ref' | 'kjv' | 'web') => {
    let text = f.copy.label;
    if (how !== 'ref') {
      try {
        text = `“${await publicDomainText(how, f.copy.span)}” (${f.copy.label}, ${how.toUpperCase()})`;
      } catch {
        setError('Couldn’t load that wording right now. Try “Use the reference”.');
        return;
      }
    }
    const swap = (s: string) => s.slice(0, f.copy.start) + text + s.slice(f.copy.end);
    touch();
    if (f.field === 'summary') setSummary(swap(summary));
    else setSteps((ss) => ss.map((s) => (String(s.k) === f.field ? { ...s, note: swap(s.note) } : s)));
    setCopies((cs) => cs.filter((x) => x !== f));
  };

  const del = async () => {
    if (!confirm(`Delete “${title || 'this lesson'}”? If it is shared, the link stops working. This can’t be undone.`)) return;
    try {
      dirty.current = false;
      await deleteNote(note.id);
      onDeleted();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Couldn’t delete.');
    }
  };

  const incomplete = steps.filter((s) => !complete(s)).length;
  const statusText = status === 'saved' ? 'Saved' : status === 'saving' ? 'Saving…' : status === 'unsaved' ? 'Not saved yet' : status === 'error' ? 'Not saved' : '';

  return (
    <div className="mine-editor lesson-editor" style={{ '--c': '#1971c2' } as React.CSSProperties}>
      <input
        className="note-title"
        value={title}
        onChange={(e) => {
          touch();
          setTitle(e.target.value);
        }}
        placeholder="Name of the lesson"
        maxLength={120}
        aria-label="Name"
      />
      <textarea
        className="note-area mine-summary"
        value={summary}
        onChange={(e) => {
          touch();
          setSummary(e.target.value);
        }}
        placeholder="A short description (optional)"
        maxLength={2000}
        rows={2}
        aria-label="Description"
      />
      <div className="mine-actions">
        <button type="button" className="btn primary" disabled={!steps.some(complete)} onClick={async () => (await save()) && onStart(note.id)}>
          ▶ Start lesson
        </button>
        <span className="note-status muted small" aria-live="polite">
          {statusText}
        </span>
      </div>

      <ShareBox noteId={note.id} />

      <h3 className="mine-h">
        {steps.length} step{steps.length === 1 ? '' : 's'}
      </h3>
      {incomplete > 0 && (
        <p className="small muted">
          {incomplete === 1 ? 'One step isn’t' : `${incomplete} steps aren’t`} saved yet: finish filling it in.
        </p>
      )}
      <ol className="mine-stops">
        {steps.map((s, i) => (
          <li key={s.k} className={`${open === s.k ? 'open' : ''}${complete(s) ? '' : ' incomplete'}`}>
            <div className="mine-row">
              <span className="mine-num">{i + 1}</span>
              <button type="button" className="mine-row-main" onClick={() => setOpen(open === s.k ? null : s.k)} aria-expanded={open === s.k}>
                <span className="mine-row-title">{s.title || stepSummary(s)}</span>
                <span className="muted small">{STEP_KINDS.find((x) => x.type === s.type)?.label}</span>
              </button>
              <span className="mine-row-tools">
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move step ${i + 1} up`}>
                  ▲
                </button>
                <button type="button" onClick={() => move(i, 1)} disabled={i === steps.length - 1} aria-label={`Move step ${i + 1} down`}>
                  ▼
                </button>
              </span>
            </div>
            {open === s.k && <StepForm step={s} onChange={(p) => setStep(s.k, p)} onRemove={() => remove(s.k)} onOpenRef={onOpenRef} />}
          </li>
        ))}
      </ol>
      {adding ? (
        <div className="lesson-add" role="group" aria-label="Add a step">
          {STEP_KINDS.map((k) => (
            <button key={k.type} type="button" className="lesson-add-kind" onClick={() => add(k.type)}>
              <strong>{k.label}</strong>
              <span className="muted small">{k.hint}</span>
            </button>
          ))}
          <button type="button" className="link-button" onClick={() => setAdding(false)}>
            Cancel
          </button>
        </div>
      ) : (
        <button type="button" className="btn vn-add" onClick={() => setAdding(true)}>
          + Add a step
        </button>
      )}

      {copies.length > 0 && (
        <div className="note-blocked" role="alert">
          <strong>Not saved: this has wording from a licensed translation.</strong> The publishers don’t allow it to be
          stored or shared. Choose what to put in its place:
          {copies.map((f, i) => {
            const idx = steps.findIndex((s) => String(s.k) === f.field);
            const where = f.field === 'summary' ? 'Description' : `Step ${idx + 1}`;
            const src = f.field === 'summary' ? summary : steps[idx]?.note ?? '';
            return (
              <div key={i} className="note-copy">
                <p className="note-copy-text">
                  {where}: “{src.slice(f.copy.start, Math.min(f.copy.end, f.copy.start + 90))}
                  {f.copy.end - f.copy.start > 90 ? '…' : ''}” ({f.copy.translation}, {f.copy.label})
                </p>
                <div className="note-copy-actions">
                  <button type="button" className="btn" onClick={() => replaceCopy(f, 'ref')}>
                    Use the reference
                  </button>
                  <button type="button" className="btn" onClick={() => replaceCopy(f, 'kjv')}>
                    KJV wording
                  </button>
                  <button type="button" className="btn" onClick={() => replaceCopy(f, 'web')}>
                    WEB wording
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {conflict && (
        <div className="note-blocked" role="alert">
          <strong>This was changed on another device.</strong>
          <div className="note-copy-actions">
            <button
              type="button"
              className="btn"
              onClick={() => {
                setVersion(conflict.version);
                setTitle(conflict.title ?? '');
                setSummary(conflict.summary ?? '');
                setSteps(withKeys(conflict.steps));
                dirty.current = false;
                setStatus('saved');
                setConflict(null);
              }}
            >
              Use the newer copy
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => {
                setVersion(conflict.version);
                touch();
                setConflict(null);
              }}
            >
              Keep mine
            </button>
          </div>
        </div>
      )}
      {error && <p className="acct-error">{error}</p>}
      <p className="note-own-words">
        Write in your own words; wording from the ESV, NASB, CSB or NKJV can’t be saved. Passages show in each reader’s
        own translation.
      </p>
      <div className="note-foot">
        <button type="button" className="acct-remove" onClick={del}>
          Delete lesson
        </button>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------------------------ Share box

function ShareBox({ noteId }: { noteId: string }) {
  const { shares } = useShares();
  const share = shares.find((s) => s.noteId === noteId);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showName, setShowName] = useState(share?.showName ?? false);
  useEffect(() => setShowName(share?.showName ?? false), [share?.showName]);

  const run = async (f: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await f();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };
  const url = share ? shareUrl(share.shareId) : '';
  return (
    <div className={`share-box${share ? ' on' : ''}`}>
      {share ? (
        <>
          <strong>Shared</strong> · anyone with this link can open it, without an account. It always shows your latest
          version.
          <div className="share-row">
            <input readOnly value={url} aria-label="Lesson link" onFocus={(e) => e.target.select()} />
            <button
              type="button"
              className="btn"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(url);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                } catch {
                  setError('Couldn’t copy; select the link and copy it.');
                }
              }}
            >
              {copied ? 'Copied' : 'Copy link'}
            </button>
          </div>
          <label className="acct-check">
            <input
              type="checkbox"
              checked={showName}
              disabled={busy}
              onChange={(e) => {
                setShowName(e.target.checked);
                run(() => shareLesson(noteId, e.target.checked));
              }}
            />
            <span>Show my display name with it</span>
          </label>
          <button type="button" className="link-button" disabled={busy} onClick={() => run(() => unshareLesson(noteId))}>
            Stop sharing
          </button>
        </>
      ) : (
        <>
          <span className="muted small">Only you can see this lesson.</span>
          <label className="acct-check">
            <input type="checkbox" checked={showName} onChange={(e) => setShowName(e.target.checked)} />
            <span>Show my display name with it</span>
          </label>
          <button type="button" className="btn" disabled={busy} onClick={() => run(() => shareLesson(noteId, showName))}>
            Share this lesson
          </button>
        </>
      )}
      {error && <p className="acct-error">{error}</p>}
    </div>
  );
}

// ------------------------------------------------------------------------------------ one step

let peopleCache: PersonEntry[] | null = null;

function StepForm({
  step,
  onChange,
  onRemove,
  onOpenRef,
}: {
  step: Step;
  onChange: (p: Partial<Step>) => void;
  onRemove: () => void;
  onOpenRef: (s: Span) => void;
}) {
  const notes = useNotes();
  const myJourneys = notes.notes.filter((n) => n.kind === 'journey');
  const myLists = notes.notes.filter((n) => n.kind === 'list');
  const passage = step.ref ? spanFromOsis(step.ref) : null;
  return (
    <div className="mine-form">
      <label className="note-meta">
        <span>Heading for this step (optional)</span>
        <input value={step.title ?? ''} onChange={(e) => onChange({ title: e.target.value })} maxLength={120} placeholder="e.g. Jesus washes their feet" />
      </label>

      {step.type === 'passage' && (
        <label className="note-meta">
          <span>Passage</span>
          <input
            value={step.refText ?? ''}
            onChange={(e) => {
              const sp = parsePassages(e.target.value)[0];
              onChange({ refText: e.target.value, ref: sp ? spanToOsis(sp) : undefined });
            }}
            placeholder="e.g. John 13:1-17"
          />
          {passage && (
            <button type="button" className="note-ref small mine-read" onClick={() => onOpenRef(passage)}>
              Read {spanLabel(passage)}
            </button>
          )}
        </label>
      )}

      {step.type === 'place' && <LessonPlace step={step} onChange={onChange} />}

      {(step.type === 'journey' || step.type === 'list') && (
        <CollectionPick
          kind={step.type}
          step={step}
          mine={step.type === 'journey' ? myJourneys : myLists}
          onChange={onChange}
        />
      )}

      {step.type === 'page' && <PagePick step={step} onChange={onChange} />}

      {step.type === 'link' && (
        <>
          <label className="note-meta">
            <span>Web address</span>
            <input value={step.url ?? ''} onChange={(e) => onChange({ url: e.target.value.trim() })} placeholder="https://…" inputMode="url" />
          </label>
          <label className="note-meta">
            <span>Label (optional)</span>
            <input value={step.label ?? ''} onChange={(e) => onChange({ label: e.target.value })} maxLength={120} placeholder="e.g. Video: the Upper Room" />
          </label>
        </>
      )}

      <label className="note-meta">
        <span>{step.type === 'note' ? 'Your notes' : 'Notes for this step (optional)'}</span>
        <textarea
          className="note-area"
          value={step.note}
          onChange={(e) => onChange({ note: e.target.value })}
          rows={step.type === 'note' ? 8 : 3}
          maxLength={5000}
          placeholder="In your own words… (**bold**, *italic*, - lists; references like John 3:16 become links)"
        />
      </label>
      <div className="note-foot">
        <button type="button" className="acct-remove" onClick={onRemove}>
          Remove this step
        </button>
      </div>
    </div>
  );
}

function LessonPlace({ step, onChange }: { step: Step; onChange: (p: Partial<Step>) => void }) {
  const [mapOpen, setMapOpen] = useState(step.lat == null);
  return (
    <PlaceField
      color="#1971c2"
      row={{ k: step.k, ref: '', refText: '', note: '', place: step.place, lat: step.lat, lon: step.lon, placeIndex: step.placeIndex } as Row}
      required
      onChange={(p) =>
        onChange({
          place: p.place ?? step.place,
          lat: 'lat' in p ? p.lat : step.lat,
          lon: 'lon' in p ? p.lon : step.lon,
          placeIndex: 'placeIndex' in p ? p.placeIndex : step.placeIndex,
        })
      }
      mapOpen={mapOpen}
      setMapOpen={setMapOpen}
      others={[]}
    />
  );
}

function CollectionPick({
  kind,
  step,
  mine,
  onChange,
}: {
  kind: 'journey' | 'list';
  step: Step;
  mine: Note[];
  onChange: (p: Partial<Step>) => void;
}) {
  const builtIn = kind === 'journey' ? JOURNEYS : LISTS;
  const value = step.id ? `${step.source}:${step.id}` : '';
  const count =
    step.source === 'mine'
      ? ((kind === 'journey' ? mine.find((n) => n.id === step.id)?.stops : mine.find((n) => n.id === step.id)?.items)?.length ?? 0)
      : kind === 'journey'
        ? (JOURNEYS.find((j) => j.id === step.id)?.stops.length ?? 0)
        : (LISTS.find((l) => l.id === step.id)?.items.length ?? 0);
  const names: string[] =
    step.source === 'mine'
      ? ((kind === 'journey' ? mine.find((n) => n.id === step.id)?.stops : mine.find((n) => n.id === step.id)?.items) ?? []).map(
          (s) => (kind === 'journey' ? s.place : s.t) ?? '',
        )
      : kind === 'journey'
        ? (JOURNEYS.find((j) => j.id === step.id)?.stops.map((s) => s.event || s.place) ?? [])
        : (LISTS.find((l) => l.id === step.id)?.items.map((s) => s.t) ?? []);
  return (
    <div className="note-meta-row">
      <label className="note-meta grow">
        <span>{kind === 'journey' ? 'Journey' : 'List'}</span>
        <select
          value={value}
          onChange={(e) => {
            const [source, ...rest] = e.target.value.split(':');
            onChange({ source: source as 'builtin' | 'mine', id: rest.join(':') || undefined, index: 0 });
          }}
        >
          <option value="">Choose…</option>
          {mine.length > 0 && (
            <optgroup label={kind === 'journey' ? 'My journeys' : 'My lists'}>
              {mine.map((n) => (
                <option key={n.id} value={`mine:${n.id}`}>
                  {n.title}
                </option>
              ))}
            </optgroup>
          )}
          <optgroup label={kind === 'journey' ? 'Journeys' : 'Study lists'}>
            {builtIn.map((x) => (
              <option key={x.id} value={`builtin:${x.id}`}>
                {x.title}
              </option>
            ))}
          </optgroup>
        </select>
      </label>
      {count > 0 && (
        <label className="note-meta">
          <span>Start at</span>
          <select value={step.index ?? 0} onChange={(e) => onChange({ index: Number(e.target.value) })}>
            {names.map((n, i) => (
              <option key={i} value={i}>
                {i + 1}. {n.slice(0, 40)}
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  );
}

function PagePick({ step, onChange }: { step: Step; onChange: (p: Partial<Step>) => void }) {
  const [people, setPeople] = useState<PersonEntry[] | null>(peopleCache);
  const [q, setQ] = useState(step.pageType === 'person' ? (step.label ?? '') : '');
  useEffect(() => {
    if (step.pageType === 'person' && !people)
      loadPeople().then((p) => {
        peopleCache = p.list;
        setPeople(p.list);
      });
  }, [step.pageType, people]);
  const matches = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!people || s.length < 2) return [];
    return people
      .filter((p) => p.title.toLowerCase().includes(s))
      .sort((a, b) => Number(!a.title.toLowerCase().startsWith(s)) - Number(!b.title.toLowerCase().startsWith(s)) || b.count - a.count)
      .slice(0, 8);
  }, [q, people]);
  const options =
    step.pageType === 'nation'
      ? NATIONS.map((n) => ({ id: n.id, label: n.name }))
      : step.pageType === 'period'
        ? PERIODS.map((p) => ({ id: p.id, label: `${p.n}. ${p.name}` }))
        : step.pageType === 'jerusalem'
          ? SPOTS.map((s) => ({ id: s.id, label: s.name }))
          : [];
  return (
    <>
      <label className="note-meta">
        <span>Kind of page</span>
        <select value={step.pageType ?? ''} onChange={(e) => onChange({ pageType: (e.target.value || undefined) as Step['pageType'], id: undefined, label: undefined })}>
          <option value="">Choose…</option>
          <option value="person">A person</option>
          <option value="nation">A nation</option>
          <option value="period">A period of Bible history</option>
          <option value="jerusalem">A spot in Jerusalem (Jesus’ day)</option>
        </select>
      </label>
      {step.pageType === 'person' && (
        <div className="note-meta mine-place-wrap">
          <span>Person</span>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Type a name, e.g. Peter" />
          {matches.length > 0 && step.label !== q && (
            <ul className="mine-suggest" role="listbox">
              {matches.map((p) => (
                <li key={p.slug}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setQ(p.title);
                      onChange({ id: p.slug, label: p.title });
                    }}
                  >
                    {p.title}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {options.length > 0 && (
        <label className="note-meta">
          <span>Which</span>
          <select
            value={step.id ?? ''}
            onChange={(e) => onChange({ id: e.target.value || undefined, label: options.find((o) => o.id === e.target.value)?.label })}
          >
            <option value="">Choose…</option>
            {options.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      )}
    </>
  );
}
