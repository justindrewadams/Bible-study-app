/**
 * Editing your own journey or study list (on the Notes page): title, colour, summary, and the stops or
 * items: place (from the Bible places, or any spot tapped on the small map), verse, note, and for journeys
 * the day/event labels and "reached by boat". Saves as you type; stops that aren't complete yet (no place
 * or verse) wait until they are. Licensed Bible wording is blocked, as in notes.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CircleMarker, MapContainer, Polyline, TileLayer, useMapEvents } from 'react-leaflet';
import { loadPlaces, type Place } from '../lib/geo';
import { findLicensedCopies, publicDomainText, type LicensedCopy } from '../lib/licenseGuard';
import { PALETTE } from '../lib/mine';
import { deleteNote, NoteConflict, saveNote, type MyStop, type Note } from '../lib/notes';
import { findRefs, spanFromOsis, spanLabel, type Span } from '../lib/refs';

interface Props {
  note: Note;
  onFollow: (noteId: string) => void;
  onOpenRef: (s: Span) => void;
  onDeleted: () => void;
}

const ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services';
const refLabel = (osis: string) => {
  const s = spanFromOsis(osis);
  return s ? spanLabel(s) : osis;
};
/** "Mark 10:46" → "Mark.10.46" (a single verse), or null */
function parseVerse(text: string): string | null {
  const r = findRefs(text)[0];
  return r && r.verse != null ? `${r.osis}.${r.chapter}.${r.verse}` : null;
}

interface Row extends MyStop {
  /** local key for React */
  k: number;
  /** what's typed in the verse box */
  refText: string;
}

let keySeq = 0;
const toRows = (list: MyStop[] | undefined): Row[] => (list ?? []).map((s) => ({ ...s, k: ++keySeq, refText: s.ref ? refLabel(s.ref) : '' }));

export default function MineEditor({ note, onFollow, onOpenRef, onDeleted }: Props) {
  const kind = note.kind as 'journey' | 'list';
  const isJourney = kind === 'journey';
  const [version, setVersion] = useState(note.version);
  const [title, setTitle] = useState(note.title ?? '');
  const [color, setColor] = useState(note.color ?? PALETTE[0]);
  const [summary, setSummary] = useState(note.summary ?? '');
  const [rows, setRows] = useState<Row[]>(() => toRows(isJourney ? note.stops : note.items));
  const [open, setOpen] = useState<number | null>(null);
  const [status, setStatus] = useState<'saved' | 'unsaved' | 'saving' | 'blocked' | 'conflict' | 'error'>('saved');
  const [copies, setCopies] = useState<{ field: string; copy: LicensedCopy }[]>([]);
  const [conflict, setConflict] = useState<Note | null>(null);
  const [error, setError] = useState<string | null>(null);
  const dirty = useRef(false);
  const word = isJourney ? 'stop' : 'item';

  const complete = (r: Row) => !!r.ref && (isJourney ? r.lat != null && r.lon != null : !!r.t?.trim());
  const incomplete = rows.filter((r) => !complete(r)).length;

  const save = useCallback(async () => {
    if (!dirty.current) return true;
    setStatus('saving');
    // licensed wording in the summary or any stop's note can't be saved
    const found: { field: string; copy: LicensedCopy }[] = [];
    for (const c of await findLicensedCopies(summary)) found.push({ field: 'summary', copy: c });
    for (const r of rows) for (const c of await findLicensedCopies(r.note ?? '')) found.push({ field: String(r.k), copy: c });
    if (found.length) {
      setCopies(found);
      setStatus('blocked');
      return false;
    }
    setCopies([]);
    const clean = rows.filter(complete).map(({ k: _k, refText: _t, ...s }) => s); // eslint-disable-line @typescript-eslint/no-unused-vars
    try {
      dirty.current = false;
      const saved = await saveNote({
        id: note.id,
        version,
        kind,
        notebookId: null,
        title: title.trim(),
        color,
        summary,
        from: note.from,
        ...(isJourney ? { stops: clean } : { items: clean }),
        body: '',
      });
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
  }, [rows, summary, title, color, version, kind, isJourney, note.id, note.from]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!dirty.current || status === 'conflict') return;
    const t = setTimeout(save, 1500);
    return () => clearTimeout(t);
  }, [rows, summary, title, color]); // eslint-disable-line react-hooks/exhaustive-deps
  const saveRef = useRef(save);
  saveRef.current = save;
  useEffect(() => () => void saveRef.current(), []);

  const touch = () => {
    dirty.current = true;
    setStatus('unsaved');
  };
  const setRow = (k: number, patch: Partial<Row>) => {
    touch();
    setRows((rs) => rs.map((r) => (r.k === k ? { ...r, ...patch } : r)));
  };
  const move = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= rows.length) return;
    touch();
    setRows((rs) => {
      const next = [...rs];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  };
  const remove = (k: number) => {
    touch();
    setRows((rs) => rs.filter((r) => r.k !== k));
    if (open === k) setOpen(null);
  };
  const add = () => {
    const last = rows[rows.length - 1];
    const r: Row = { k: ++keySeq, ref: last?.ref ?? '', refText: last?.ref ? refLabel(last.ref) : '', note: '', ...(isJourney ? {} : { t: '' }) };
    touch();
    setRows((rs) => [...rs, r]);
    setOpen(r.k);
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
    else setRows((rs) => rs.map((r) => (String(r.k) === f.field ? { ...r, note: swap(r.note ?? '') } : r)));
    setCopies((cs) => cs.filter((x) => x !== f));
  };

  const del = async () => {
    if (!confirm(`Delete “${title || (isJourney ? 'this journey' : 'this list')}”? This can’t be undone.`)) return;
    try {
      dirty.current = false;
      await deleteNote(note.id);
      onDeleted();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Couldn’t delete.');
    }
  };

  const statusText = status === 'saved' ? 'Saved' : status === 'saving' ? 'Saving…' : status === 'unsaved' ? 'Not saved yet' : status === 'error' ? 'Not saved' : '';

  return (
    <div className="mine-editor" style={{ '--c': color } as React.CSSProperties}>
      <input
        className="note-title"
        value={title}
        onChange={(e) => {
          touch();
          setTitle(e.target.value);
        }}
        placeholder={isJourney ? 'Name of the journey' : 'Name of the list'}
        maxLength={120}
        aria-label="Name"
      />
      <div className="mine-colors" role="radiogroup" aria-label="Colour">
        {PALETTE.map((c) => (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={c === color}
            aria-label={`Colour ${c}`}
            className={`mine-swatch${c === color ? ' on' : ''}`}
            style={{ background: c }}
            onClick={() => {
              touch();
              setColor(c);
            }}
          />
        ))}
      </div>
      <textarea
        className="note-area mine-summary"
        value={summary}
        onChange={(e) => {
          touch();
          setSummary(e.target.value);
        }}
        placeholder="A short description (optional)"
        maxLength={1000}
        rows={2}
        aria-label="Description"
      />

      <div className="mine-actions">
        <button type="button" className="btn primary" disabled={!rows.some(complete)} onClick={async () => (await save()) && onFollow(note.id)}>
          {isJourney ? '▶ Follow this journey' : '▶ Study this list'}
        </button>
        <span className="note-status muted small" aria-live="polite">
          {statusText}
        </span>
      </div>

      <h3 className="mine-h">
        {rows.length} {word}
        {rows.length === 1 ? '' : 's'}
      </h3>
      {incomplete > 0 && (
        <p className="small muted">
          {incomplete === 1 ? `One ${word} isn’t` : `${incomplete} ${word}s aren’t`} saved yet: {isJourney ? 'each stop needs a place and a verse.' : 'each item needs a name and a verse.'}
        </p>
      )}
      <ol className="mine-stops">
        {rows.map((r, i) => (
          <li key={r.k} className={`${open === r.k ? 'open' : ''}${complete(r) ? '' : ' incomplete'}`}>
            <div className="mine-row">
              <span className="mine-num">{i + 1}</span>
              <button type="button" className="mine-row-main" onClick={() => setOpen(open === r.k ? null : r.k)} aria-expanded={open === r.k}>
                <span className="mine-row-title">{(isJourney ? r.place : r.t) || <em className="muted">New {word}</em>}</span>
                <span className="muted small">
                  {[r.ref ? refLabel(r.ref) : '', isJourney && r.event ? r.event : '', r.sea ? 'by boat' : ''].filter(Boolean).join(' · ')}
                </span>
              </button>
              <span className="mine-row-tools">
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move ${word} ${i + 1} up`}>
                  ▲
                </button>
                <button type="button" onClick={() => move(i, 1)} disabled={i === rows.length - 1} aria-label={`Move ${word} ${i + 1} down`}>
                  ▼
                </button>
              </span>
            </div>
            {open === r.k && (
              <StopForm
                color={color}
                row={r}
                isJourney={isJourney}
                others={rows}
                onChange={(p) => setRow(r.k, p)}
                onRemove={() => remove(r.k)}
                onOpenRef={onOpenRef}
              />
            )}
          </li>
        ))}
      </ol>
      <button type="button" className="btn vn-add" onClick={add}>
        + Add {word}
      </button>

      {copies.length > 0 && (
        <div className="note-blocked" role="alert">
          <strong>Not saved: this has wording from a licensed translation.</strong> The publishers don’t allow it to be
          stored. Choose what to put in its place:
          {copies.map((f, i) => {
            const where = f.field === 'summary' ? 'Description' : `${isJourney ? 'Stop' : 'Item'} ${rows.findIndex((r) => String(r.k) === f.field) + 1}`;
            const src = f.field === 'summary' ? summary : rows.find((r) => String(r.k) === f.field)?.note ?? '';
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
                setColor(conflict.color ?? PALETTE[0]);
                setSummary(conflict.summary ?? '');
                setRows(toRows(isJourney ? conflict.stops : conflict.items));
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
        Notes are in your own words; wording from the ESV, NASB, CSB or NKJV can’t be saved.
        {note.from && ' This is your own copy; the original stays as it was.'}
      </p>
      <div className="note-foot">
        <button type="button" className="acct-remove" onClick={del}>
          Delete {isJourney ? 'journey' : 'list'}
        </button>
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------- one stop or item

function StopForm({
  color,
  row,
  isJourney,
  others,
  onChange,
  onRemove,
  onOpenRef,
}: {
  color: string;
  row: Row;
  isJourney: boolean;
  others: Row[];
  onChange: (p: Partial<Row>) => void;
  onRemove: () => void;
  onOpenRef: (s: Span) => void;
}) {
  const [mapOpen, setMapOpen] = useState(isJourney && row.lat == null);
  const verse = row.refText.trim() ? parseVerse(row.refText) : null;
  return (
    <div className="mine-form">
      {!isJourney && (
        <label className="note-meta">
          <span>Name</span>
          <input value={row.t ?? ''} onChange={(e) => onChange({ t: e.target.value })} placeholder="e.g. Love" maxLength={120} />
        </label>
      )}
      <label className="note-meta">
        <span>Verse</span>
        <input
          value={row.refText}
          onChange={(e) => {
            const ref = parseVerse(e.target.value);
            onChange({ refText: e.target.value, ref: ref ?? '' });
          }}
          placeholder="e.g. Mark 10:46"
        />
        {row.refText.trim() && !verse && <span className="acct-hint">Type a book, chapter and verse, e.g. John 3:16.</span>}
        {verse && (
          <button type="button" className="note-ref small mine-read" onClick={() => onOpenRef(spanFromOsis(verse)!)}>
            Read {refLabel(verse)}
          </button>
        )}
      </label>
      <PlaceField color={color} row={row} required={isJourney} onChange={onChange} mapOpen={mapOpen} setMapOpen={setMapOpen} others={others} />
      {isJourney && (
        <div className="note-meta-row">
          <label className="note-meta grow">
            <span>Day (optional)</span>
            <input value={row.day ?? ''} onChange={(e) => onChange({ day: e.target.value })} placeholder="e.g. Sunday" maxLength={40} />
          </label>
          <label className="note-meta grow">
            <span>What happened (optional)</span>
            <input value={row.event ?? ''} onChange={(e) => onChange({ event: e.target.value })} placeholder="e.g. The triumphal entry" maxLength={80} />
          </label>
        </div>
      )}
      {!isJourney && (
        <label className="note-meta">
          <span>Word to bold in the verse (optional)</span>
          <input
            value={(row.words ?? []).join(', ')}
            onChange={(e) =>
              onChange({
                words: e.target.value
                  .split(',')
                  .map((w) => w.trim())
                  .filter(Boolean)
                  .slice(0, 6),
              })
            }
            placeholder="e.g. joy"
          />
        </label>
      )}
      <label className="note-meta">
        <span>Note</span>
        <textarea
          className="note-area"
          value={row.note ?? ''}
          onChange={(e) => onChange({ note: e.target.value })}
          rows={3}
          maxLength={1500}
          placeholder="In your own words…"
        />
      </label>
      {isJourney && (
        <label className="acct-check">
          <input type="checkbox" checked={!!row.sea} onChange={(e) => onChange({ sea: e.target.checked || undefined })} />
          <span>Reached by boat (drawn across the water, not along roads)</span>
        </label>
      )}
      <div className="note-foot">
        <button type="button" className="acct-remove" onClick={onRemove}>
          Remove this {isJourney ? 'stop' : 'item'}
        </button>
      </div>
    </div>
  );
}

let placesCache: Place[] | null = null;

function PlaceField({
  color,
  row,
  required,
  onChange,
  mapOpen,
  setMapOpen,
  others,
}: {
  color: string;
  row: Row;
  required: boolean;
  onChange: (p: Partial<Row>) => void;
  mapOpen: boolean;
  setMapOpen: (v: boolean) => void;
  others: Row[];
}) {
  const [places, setPlaces] = useState<Place[] | null>(placesCache);
  const [q, setQ] = useState(row.place ?? '');
  const [focus, setFocus] = useState(false);
  useEffect(() => {
    if (!places)
      loadPlaces().then((p) => {
        placesCache = p;
        setPlaces(p);
      });
  }, [places]);
  const matches = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!places || s.length < 2) return [];
    const starts = places.filter((p) => p.name.toLowerCase().startsWith(s));
    const has = places.filter((p) => !p.name.toLowerCase().startsWith(s) && p.name.toLowerCase().includes(s));
    return [...starts, ...has].slice(0, 8);
  }, [q, places]);
  return (
    <div className="note-meta mine-place">
      <span>{required ? 'Place' : 'Place on the map (optional)'}</span>
      <div className="mine-place-wrap">
        <div className="mine-place-row">
          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              onChange({ place: e.target.value, placeIndex: null });
            }}
            onFocus={() => setFocus(true)}
            onBlur={() => setTimeout(() => setFocus(false), 150)}
            placeholder="Type a place, or tap the map"
            aria-label="Place"
            maxLength={80}
          />
          <button type="button" className={`btn${mapOpen ? ' active' : ''}`} onClick={() => setMapOpen(!mapOpen)} aria-pressed={mapOpen}>
            Map
          </button>
        </div>
        {focus && matches.length > 0 && (
          <ul className="mine-suggest" role="listbox">
            {matches.map((p) => (
              <li key={p.index}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    setQ(p.name);
                    onChange({ place: p.name, lat: p.lat, lon: p.lon, placeIndex: p.index });
                    setFocus(false);
                  }}
                >
                  {p.name}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {row.lat != null && (
        <span className="acct-hint">
          {row.placeIndex != null ? 'A Bible place.' : 'A spot you chose on the map.'}{' '}
          {!required && (
            <button type="button" className="link-button" onClick={() => onChange({ lat: undefined, lon: undefined, placeIndex: null })}>
              Clear
            </button>
          )}
        </span>
      )}
      {mapOpen && (
        <PickMap
          color={color}
          row={row}
          others={others}
          onPick={(lat, lon) => {
            const name = q.trim() || 'A spot on the map';
            setQ(name);
            onChange({ lat, lon, placeIndex: null, place: name });
          }}
        />
      )}
    </div>
  );
}

function ClickToPick({ onPick }: { onPick: (lat: number, lon: number) => void }) {
  useMapEvents({ click: (e) => onPick(e.latlng.lat, e.latlng.lng) });
  return null;
}

/** A small map: tap to put this stop anywhere. The other stops show for reference. */
function PickMap({ color, row, others, onPick }: { color: string; row: Row; others: Row[]; onPick: (lat: number, lon: number) => void }) {
  const pts = others.filter((r) => r.lat != null && r.lon != null);
  const center: [number, number] = row.lat != null ? [row.lat, row.lon!] : pts.length ? [pts[pts.length - 1].lat!, pts[pts.length - 1].lon!] : [31.78, 35.23];
  return (
    <div className="mine-map">
      <MapContainer center={center} zoom={row.lat != null ? 10 : 8} maxZoom={13} scrollWheelZoom={false} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          url={`${ESRI}/World_Terrain_Base/MapServer/tile/{z}/{y}/{x}`}
          maxNativeZoom={9}
          attribution="Powered by Esri &mdash; Source: USGS, Esri, TANA, DeLorme, NPS"
          className="tiles-parchment"
        />
        <TileLayer url={`${ESRI}/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}`} opacity={0.5} maxNativeZoom={13} />
        {pts.length > 1 && <Polyline positions={pts.map((r) => [r.lat!, r.lon!] as [number, number])} pathOptions={{ color, weight: 2, dashArray: '4 4' }} />}
        {pts.map((r) => (
          <CircleMarker
            key={r.k}
            center={[r.lat!, r.lon!]}
            radius={r.k === row.k ? 8 : 4}
            pathOptions={{ color: '#111', weight: 2, fillColor: r.k === row.k ? '#f05a28' : '#fff', fillOpacity: 1 }}
          />
        ))}
        <ClickToPick onPick={onPick} />
      </MapContainer>
      <span className="mine-map-hint">Tap the map to place this stop</span>
    </div>
  );
}
