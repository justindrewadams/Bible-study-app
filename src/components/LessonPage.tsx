/**
 * A class lesson as one scrolling page: every step is a section, with its verses, a small map, a summary
 * of the person, nation, period or Jerusalem spot, or a link card, all on the page at once. The arrow keys
 * or a clicker (while presenting) move from one step to the next; on a computer a list of the steps sits at
 * the side.
 *
 * Bible text: passages show in the translation being read. For the licensed translations the page keeps to
 * the same limits as the reader: at most 500 verses on the page, and for the ESV never half of a book.
 * Passages past that show as a reference with a "Read" button.
 */
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { CircleMarker, MapContainer, Polyline, TileLayer, Tooltip, useMap } from 'react-leaflet';
import { NATIONS } from '../data/nations';
import { PERIODS } from '../data/periods';
import { spotById } from '../data/jerusalem';
import { api } from '../lib/account';
import {
  ESV_TERMS,
  fetchPassage,
  findTranslation,
  FALLBACK_TRANSLATION,
  isLicensed,
  LicensedUnavailable,
  translationNotice,
  versesInChapter,
  type Translation,
} from '../lib/bible';
import { spanParts, spanVerseCount, type PassageVerse } from '../lib/exportDoc';
import { allJourneys, legPath, type Journey } from '../lib/journeys';
import { stepTargetId, type OpenLesson } from '../lib/lessons';
import { allLists } from '../lib/lists';
import type { LessonStep } from '../lib/notes';
import { bioParts, formatYear, loadPeople, loadPerson } from '../lib/people';
import { spanFromOsis, spanLabel, type Span } from '../lib/refs';
import { stepSummary, STEP_KINDS } from './LessonEditor';
import { ReportForm } from './LessonPanel';
import NoteText from './NoteText';

interface Props {
  lesson: OpenLesson;
  translation: Translation;
  esvKey: string;
  /** presenting: one step forward (d 1) or back (d -1), through a journey's stops first; n changes each time */
  jump: { d: number; n: number };
  /** the step now in view */
  onIndex: (i: number) => void;
  current: number;
  /** false while you've stepped out of the lesson (the page stays, hidden, to come back to) */
  shown: boolean;
  onClose: () => void;
  onOpenRef: (s: Span) => void;
  onShowPlace: (s: LessonStep) => void;
  onOpenPage: (s: LessonStep) => void;
  presenting: boolean;
  onPresent: () => void;
  signedIn: boolean;
  isAdmin: boolean;
  onSaveCopy: () => Promise<void>;
  onRemoved: () => void;
}

const nice = (t: Translation) => (t.code === 'NASB1995' ? 'NASB 1995' : t.code.toUpperCase());

// ------------------------------------------------------------------------------------ Bible text

type PassageState =
  | { s: 'loading' }
  | { s: 'ok'; verses: PassageVerse[]; code: string }
  | { s: 'limit' }
  | { s: 'error' };

const bookTotal = (osis: string) => {
  let n = 0;
  for (let c = 1; versesInChapter(osis, c); c++) n += versesInChapter(osis, c);
  return n;
};

/**
 * The verses on a lesson page: passages, journey stops and list items, fetched one after another and kept
 * within the translation's limit for one page (shared by everything on it). `gen` changes when the
 * translation does, and everything is asked for again.
 */
interface VerseStore {
  gen: number;
  /** the translations actually shown on the page */
  codes: Set<string>;
  get: (key: string) => PassageState | undefined;
  request: (key: string, span: Span) => void;
}

function useVerseStore(t: Translation, esvKey: string): VerseStore {
  const [state, setState] = useState<Record<string, PassageState>>({});
  const fresh = (gen: number) => ({ gen, id: `${t.id}|${esvKey}`, chain: Promise.resolve(), asked: new Set<string>(), used: 0, perBook: new Map<string, number>() });
  const run = useRef(fresh(0));
  if (run.current.id !== `${t.id}|${esvKey}`) run.current = fresh(run.current.gen + 1);
  const r = run.current;

  const fetchOne = async (sp: Span): Promise<PassageState> => {
    const licensed = isLicensed(t);
    const total = licensed ? ESV_TERMS.maxVersesPerPage : Infinity;
    const count = spanVerseCount(sp);
    const inBook = (r.perBook.get(sp.osis) ?? 0) + count;
    const bookMax = t.provider === 'esv' ? Math.floor(bookTotal(sp.osis) * ESV_TERMS.maxBookFraction) : Infinity;
    if (!count || r.used + count > total || inBook > bookMax) return { s: 'limit' };
    const get = async (tr: Translation) => {
      const verses: PassageVerse[] = [];
      for (const p of spanParts(sp)) {
        const got = await fetchPassage(tr, sp.osis, p.chapter, { from: p.from, to: p.to }, { esvKey });
        for (const v of got) if (v.verse >= p.from && v.verse <= p.to) verses.push({ chapter: p.chapter, verse: v.verse, text: v.text });
      }
      if (!verses.length) throw new Error('no verses');
      return verses;
    };
    try {
      const verses = await get(t);
      r.used += count;
      r.perBook.set(sp.osis, inBook);
      return { s: 'ok', verses, code: nice(t) };
    } catch (e) {
      // a licensed translation that can't be reached right now: the public-domain WEB, labelled
      if (e instanceof LicensedUnavailable && licensed) {
        const web = findTranslation(FALLBACK_TRANSLATION);
        return get(web).then(
          (verses): PassageState => ({ s: 'ok', verses, code: nice(web) }),
          (): PassageState => ({ s: 'error' }),
        );
      }
      return { s: 'error' };
    }
  };

  const codes = new Set(
    Object.entries(state).flatMap(([k, v]) => (k.startsWith(`${r.gen}:`) && v.s === 'ok' ? [v.code] : [])),
  );
  return {
    gen: r.gen,
    codes,
    get: (key) => state[`${r.gen}:${key}`],
    request: (key, sp) => {
      const k = `${r.gen}:${key}`;
      if (r.asked.has(k)) return;
      r.asked.add(k);
      setState((m) => ({ ...m, [k]: { s: 'loading' } }));
      r.chain = r.chain.then(async () => {
        const next = await fetchOne(sp);
        if (run.current === r) setState((m) => ({ ...m, [k]: next }));
      });
    },
  };
}

function Passage({ span, st, onRead, compact }: { span: Span; st: PassageState | undefined; onRead: () => void; compact?: boolean }) {
  if (!st || st.s === 'loading') return <p className="muted small ls-loading">Getting the verses…</p>;
  if (st.s !== 'ok')
    return compact ? (
      <p className="muted small ls-omitted">
        <button className="link-button" onClick={onRead}>
          Read {spanLabel(span)}
        </button>{' '}
        {st.s === 'limit' ? '(past the publisher’s limit for one page)' : '(couldn’t be fetched right now)'}
      </p>
    ) : (
      <p className="muted small ls-omitted">
        {st.s === 'limit'
          ? 'Shown as a reference only: the publisher allows only so many verses on one page.'
          : 'The verses couldn’t be fetched right now.'}{' '}
        <button className="link-button" onClick={onRead}>
          Read {spanLabel(span)}
        </button>
      </p>
    );
  let last = span.chapter;
  const one = st.verses.length === 1;
  return (
    <p className={`ls-verses${compact ? ' compact' : ''}`}>
      {st.verses.map((v, i) => {
        const num = v.chapter !== last ? `${v.chapter}:${v.verse}` : `${v.verse}`;
        last = v.chapter;
        return (
          <Fragment key={i}>
            {!one && <sup>{num}</sup>} {v.text}{' '}
          </Fragment>
        );
      })}
      <span className="ls-code">({st.code})</span>
    </p>
  );
}

// ------------------------------------------------------------------------------------ small maps

const TERRAIN = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Terrain_Base/MapServer/tile/{z}/{y}/{x}';

/** Renders its children only once it comes near the screen (so maps load as you scroll). */
function WhenNear({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || near) return;
    if (!('IntersectionObserver' in window)) return setNear(true);
    const io = new IntersectionObserver((es) => es.some((e) => e.isIntersecting) && setNear(true), { rootMargin: '600px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [near]);
  return (
    <div ref={ref} className={className}>
      {near ? children : null}
    </div>
  );
}

/** Keeps a small map filling its box when the page's layout changes (presenting, a rotated phone), still showing its places. */
function KeepFitted({ fit }: { fit: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    const el = map.getContainer();
    if (!('ResizeObserver' in window)) return;
    const ro = new ResizeObserver(() => {
      map.invalidateSize();
      if (fit.length > 1) map.fitBounds(fit, { padding: [28, 28], maxZoom: 10 });
      else if (fit[0]) map.setView(fit[0], map.getZoom());
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [map]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

function MiniMap({ points, line, focus, color }: { points: { lat: number; lon: number; name: string }[]; line?: [number, number][]; focus: number; color: string }) {
  const all: [number, number][] = [...points.map((p) => [p.lat, p.lon] as [number, number]), ...(line ?? [])];
  const single = all.length < 2;
  return (
    <WhenNear className="ls-map">
      <MapContainer
        {...(single ? { center: all[0], zoom: 8 } : { bounds: all, boundsOptions: { padding: [28, 28], maxZoom: 10 } })}
        className="ls-map-inner"
        dragging={false}
        scrollWheelZoom={false}
        doubleClickZoom={false}
        touchZoom={false}
        boxZoom={false}
        keyboard={false}
        zoomControl={false}
        attributionControl
      >
        <KeepFitted fit={all} />
        <TileLayer url={TERRAIN} maxNativeZoom={9} maxZoom={11} className="tiles-parchment" attribution="Powered by Esri &mdash; Source: USGS, Esri, TANA, DeLorme, NPS" />
        {line && line.length > 1 && <Polyline positions={line} pathOptions={{ color, weight: 3, opacity: 0.85 }} />}
        {points.map((p, i) => (
          <CircleMarker
            key={i}
            center={[p.lat, p.lon]}
            radius={i === focus ? 8 : 4}
            pathOptions={{ color: i === focus ? '#111' : color, weight: i === focus ? 2.5 : 1.5, fillColor: i === focus ? color : '#fff', fillOpacity: 1 }}
          >
            {i === focus && (
              <Tooltip permanent direction="top" offset={[0, -8]} className="ls-map-label">
                {p.name}
              </Tooltip>
            )}
          </CircleMarker>
        ))}
      </MapContainer>
    </WhenNear>
  );
}

// ------------------------------------------------------------------------------------ page summaries

function PersonSummary({ slug, showTitle }: { slug: string; showTitle: boolean }) {
  const [info, setInfo] = useState<{ title: string; count: number; years: string; bio: string } | null | undefined>(undefined);
  useEffect(() => {
    let off = false;
    Promise.all([loadPeople(), loadPerson(slug)])
      .then(([{ bySlug }, d]) => {
        if (off) return;
        const e = bySlug.get(slug);
        if (!e) return setInfo(null);
        const years = [d?.born != null ? `born ${formatYear(d.born)}` : '', d?.died != null ? `died ${formatYear(d.died)}` : ''].filter(Boolean).join(' · ');
        const first = d?.bio?.[0] ? bioParts(d.bio[0]).map((p) => p.text).join('') : '';
        const bio = first.length > 420 ? `${first.slice(0, 400).replace(/\s+\S*$/, '')}…` : first;
        setInfo({ title: e.title, count: e.count, years, bio });
      })
      .catch(() => !off && setInfo(null));
    return () => {
      off = true;
    };
  }, [slug]);
  if (info === undefined) return <p className="muted small">Loading…</p>;
  if (!info) return null;
  return (
    <>
      {showTitle && <p className="ls-card-title">{info.title}</p>}
      <p className="muted small">
        Named in {info.count} {info.count === 1 ? 'verse' : 'verses'}
        {info.years ? ` · ${info.years}` : ''}
      </p>
      {info.bio && <p className="ls-card-text">{info.bio}</p>}
      {info.bio && <p className="muted small">From Easton’s Bible Dictionary (1897).</p>}
    </>
  );
}

function PageSummary({ step }: { step: LessonStep }) {
  if (!step.id) return null;
  // the step's heading already names it when the title wasn't changed
  const Title = ({ children }: { children: React.ReactNode }) =>
    !step.title || step.title === step.label ? null : <p className="ls-card-title">{children}</p>;
  if (step.pageType === 'person') return <PersonSummary slug={step.id} showTitle={!!step.title && step.title !== step.label} />;
  if (step.pageType === 'nation') {
    const n = NATIONS.find((x) => x.id === step.id);
    if (!n) return null;
    return (
      <>
        <Title>{n.name}</Title>
        <p className="muted small">{n.region}</p>
        {n.history[0] && <p className="ls-card-text">{n.history[0]}</p>}
      </>
    );
  }
  if (step.pageType === 'period') {
    const p = PERIODS.find((x) => x.id === step.id);
    if (!p) return null;
    return (
      <>
        <Title>
          {p.n}. {p.name}
        </Title>
        <p className="muted small">{p.dates}</p>
        <p className="ls-card-text">{p.summary}</p>
      </>
    );
  }
  if (step.pageType === 'jerusalem') {
    const s = spotById(step.id);
    if (!s) return null;
    return (
      <>
        <Title>{s.name}</Title>
        <p className="muted small">{s.plan === 'temple' ? 'The temple' : 'Jerusalem'}</p>
        <p className="ls-card-text">{s.text}</p>
      </>
    );
  }
  return null;
}

// ------------------------------------------------------------------------------------ a journey, in the lesson

const coarse = () => typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;

/** The route from the first stop to stop `at` (the part travelled so far). */
function routeTo(j: Journey, at: number): [number, number][] {
  const out: [number, number][] = [[j.stops[0].lat, j.stops[0].lon]];
  for (let k = 1; k <= at; k++) out.push(...legPath(j, k).slice(1));
  return out;
}

/** Moves the map to the leg just travelled when the stop changes, and keeps it filling its box. */
function FollowStop({ j, at }: { j: Journey; at: number }) {
  const map = useMap();
  const first = useRef(true);
  const show = (animate: boolean) => {
    const st = j.stops[at];
    const pts = at > 0 ? legPath(j, at) : [[st.lat, st.lon] as [number, number]];
    if (pts.length > 1) map.fitBounds(pts, { padding: [50, 50], maxZoom: 11, animate });
    else map.setView([st.lat, st.lon], Math.max(map.getZoom(), 8), { animate });
  };
  useEffect(() => {
    // the first view shows the whole journey
    if (first.current) {
      first.current = false;
      return;
    }
    show(true);
  }, [at]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!('ResizeObserver' in window)) return;
    let w = 0;
    let h = 0;
    const ro = new ResizeObserver(([e]) => {
      const { width, height } = e.contentRect;
      if (Math.abs(width - w) < 2 && Math.abs(height - h) < 2) return;
      const firstSize = !w;
      w = width;
      h = height;
      if (firstSize) return;
      map.invalidateSize();
      show(false);
    });
    ro.observe(map.getContainer());
    return () => ro.disconnect();
  }, [map]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

function JourneyMap({ j, at, onPick }: { j: Journey; at: number; onPick: (k: number) => void }) {
  const whole = useMemo(() => routeTo(j, j.stops.length - 1), [j]);
  const travelled = useMemo(() => routeTo(j, at), [j, at]);
  const touch = coarse();
  return (
    <WhenNear className="ls-map ls-journey-map">
      <MapContainer
        bounds={whole.length > 1 ? whole : undefined}
        center={whole.length > 1 ? undefined : whole[0]}
        zoom={whole.length > 1 ? undefined : 8}
        boundsOptions={{ padding: [28, 28], maxZoom: 10 }}
        className="ls-map-inner"
        scrollWheelZoom={false}
        dragging={!touch}
        touchZoom
        keyboard={false}
        attributionControl
      >
        <FollowStop j={j} at={at} />
        <TileLayer url={TERRAIN} maxNativeZoom={9} maxZoom={11} className="tiles-parchment" attribution="Powered by Esri &mdash; Source: USGS, Esri, TANA, DeLorme, NPS" />
        {whole.length > 1 && <Polyline positions={whole} pathOptions={{ color: j.color, weight: 2, opacity: 0.4, dashArray: '4 6' }} />}
        {travelled.length > 1 && <Polyline positions={travelled} pathOptions={{ color: j.color, weight: 4, opacity: 0.9 }} />}
        {j.stops.map((st, k) => (
          <CircleMarker
            // a new marker when it becomes (or stops being) the current stop, so its label follows
            key={k === at ? `${k}-at` : k}
            center={[st.lat, st.lon]}
            radius={k === at ? 9 : 5}
            eventHandlers={{ click: () => onPick(k) }}
            pathOptions={{ color: k === at ? '#111' : j.color, weight: k === at ? 2.5 : 1.5, fillColor: k === at ? j.color : '#fff', fillOpacity: 1 }}
          >
            <Tooltip permanent={k === at} direction="top" offset={[0, -8]} className="ls-map-label">
              {st.place}
            </Tooltip>
          </CircleMarker>
        ))}
      </MapContainer>
    </WhenNear>
  );
}

function JourneyStep({ step, i, lesson, at, setAt, store, props, notes }: BodyProps & { notes: React.ReactNode }) {
  const j = journeyFor(step, lesson);
  const stop = j?.stops[at];
  const sp = stop ? spanFromOsis(stop.ref) : null;
  // the stop's verses, and the next stop's ready for Next
  useEffect(() => {
    if (!j) return;
    for (const k of [at, at + 1]) {
      const s2 = j.stops[k] && spanFromOsis(j.stops[k].ref);
      if (s2) store.request(`j${i}:${k}`, s2);
    }
  }, [j?.id, at, store.gen]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!j || !stop) return <p className="muted small">This journey is no longer available.</p>;
  const last = j.stops.length - 1;
  return (
    <>
      {j.summary && !step.title && <p className="muted small ls-list-summary">{j.summary}</p>}
      <div className="ls-jgrid" style={{ '--c': j.color } as React.CSSProperties}>
        <JourneyMap j={j} at={at} onPick={setAt} />
        <div className="ls-stop" aria-live="polite">
          <p className="ls-stop-where">
            Stop {at + 1} of {j.stops.length}
            {stop.day ? ` · ${stop.day}` : ''}
          </p>
          <h3>{stop.place}</h3>
          {stop.event && <p className="ls-stop-event">{stop.event}</p>}
          {sp && <Passage compact span={sp} st={store.get(`j${i}:${at}`)} onRead={() => props.onOpenRef(sp)} />}
          {stop.note && stop.note !== stop.event && <p className="ls-item-note">{stop.note}</p>}
          <div className="ls-stop-nav">
            <button className="btn" onClick={() => setAt(at - 1)} disabled={at === 0} aria-label="Previous stop">
              ‹ Prev
            </button>
            <button className="btn primary" onClick={() => setAt(at + 1)} disabled={at === last} aria-label="Next stop">
              Next ›
            </button>
            {sp && (
              <button className="link-button ls-read small" onClick={() => props.onOpenRef(sp)}>
                Read {spanLabel(sp)} in context
              </button>
            )}
          </div>
        </div>
      </div>
      {notes}
    </>
  );
}

// ------------------------------------------------------------------------------------ one step

const journeyFor = (s: LessonStep, l: OpenLesson) => (s.type === 'journey' ? allJourneys().find((x) => x.id === stepTargetId(s, l)) : undefined);
const listFor = (s: LessonStep, l: OpenLesson) => (s.type === 'list' ? allLists().find((x) => x.id === stepTargetId(s, l)) : undefined);

/** A step's heading: its own title, else what it shows. */
function heading(s: LessonStep, l: OpenLesson): string {
  if (s.title) return s.title;
  if (s.type === 'journey') return journeyFor(s, l)?.title ?? stepSummary(s);
  if (s.type === 'list') return listFor(s, l)?.title ?? stepSummary(s);
  return stepSummary(s);
}

interface BodyProps {
  step: LessonStep;
  i: number;
  lesson: OpenLesson;
  store: VerseStore;
  /** journeys: the stop shown */
  at: number;
  setAt: (k: number) => void;
  props: Props;
}

function StepBody({ step, i, lesson, store, at, setAt, props }: BodyProps) {
  const passage = store.get(`p${i}`);
  const sp = step.ref ? spanFromOsis(step.ref) : null;
  const readLink = sp && step.type !== 'passage' && (
    <button className="link-button ls-read" onClick={() => props.onOpenRef(sp)}>
      Read {spanLabel(sp)}
    </button>
  );
  const notes = step.note.trim() && <NoteText text={step.note} onOpenRef={props.onOpenRef} className="ls-note" />;

  switch (step.type) {
    case 'passage':
      return (
        <>
          {sp && <Passage span={sp} st={passage} onRead={() => props.onOpenRef(sp)} />}
          {notes}
          {sp && (
            <p className="ls-actions">
              <button className="btn" onClick={() => props.onOpenRef(sp)}>
                Read in context
              </button>
            </p>
          )}
        </>
      );
    case 'note':
      return <>{notes}</>;
    case 'place':
      return (
        <>
          {step.lat != null && step.lon != null && (
            <MiniMap points={[{ lat: step.lat, lon: step.lon, name: step.place || 'Here' }]} focus={0} color="#1971c2" />
          )}
          {notes}
          <p className="ls-actions">
            <button className="btn" onClick={() => props.onShowPlace(step)}>
              Show on the big map
            </button>
            {readLink}
          </p>
        </>
      );
    case 'journey':
      return <JourneyStep step={step} i={i} lesson={lesson} at={at} setAt={setAt} store={store} props={props} notes={notes} />;
    case 'list': {
      const l = listFor(step, lesson);
      if (!l || !l.items.length) return <p className="muted small">This list is no longer available.</p>;
      const picked = Math.min(step.index ?? 0, l.items.length - 1);
      return (
        <>
          {l.summary && <p className="muted small ls-list-summary">{l.summary}</p>}
          {notes}
          <ol className="ls-items">
            {l.items.map((it, k) => {
              const isp = spanFromOsis(it.ref);
              const st = store.get(`l${i}:${k}`);
              // a note that only quotes the verse isn't needed once the verse is printed
              const quoteOnly = !!it.note && /^["“]/.test(it.note.trim()) && st?.s === 'ok';
              return (
                <li key={k} className={[k === picked ? 'picked' : '', /^\d/.test(it.t) ? 'own-num' : ''].join(' ').trim() || undefined}>
                  {!/^\d/.test(it.t) && <span className="ls-item-num">{k + 1}</span>}
                  <p className="ls-item-head">
                    <strong>{it.t}</strong>
                    {it.meta && <span className="muted small"> · {it.meta}</span>}
                    {it.tag && <span className={`ls-tag ${it.tag}`}>{it.tag === 'good' ? 'Good' : 'Evil'}</span>}
                  </p>
                  {isp && <Passage compact span={isp} st={st} onRead={() => props.onOpenRef(isp)} />}
                  {it.note && !quoteOnly && <p className="ls-item-note">{it.note}</p>}
                  {isp && (
                    <button className="link-button ls-read small" onClick={() => props.onOpenRef(isp)}>
                      Read {spanLabel(isp)} in context
                    </button>
                  )}
                </li>
              );
            })}
          </ol>
        </>
      );
    }
    case 'page':
      return (
        <>
          <div className="ls-card">
            <PageSummary step={step} />
          </div>
          {notes}
          <p className="ls-actions">
            <button className="btn" onClick={() => props.onOpenPage(step)}>
              Open the full page
            </button>
            {readLink}
          </p>
        </>
      );
    case 'link': {
      let host = 'another website';
      try {
        host = new URL(step.url ?? '').hostname.replace(/^www\./, '');
      } catch {
        /* shown as "another website" */
      }
      return (
        <>
          <div className="ls-card ls-link-card">
            {step.title && step.title !== (step.label || host) && <p className="ls-card-title">{step.label || host}</p>}
            <p className="muted small">Opens {host} in a new tab</p>
          </div>
          {notes}
          <p className="ls-actions">
            {step.url && (
              <a className="btn" href={step.url} target="_blank" rel="noopener noreferrer">
                Open link ↗
              </a>
            )}
            {readLink}
          </p>
        </>
      );
    }
  }
}

// ------------------------------------------------------------------------------------ the page

export default function LessonPage(props: Props) {
  const { lesson, translation, esvKey, jump, onIndex, current, onClose } = props;
  const pageRef = useRef<HTMLDivElement>(null);
  const lastTop = useRef(0);
  const [reporting, setReporting] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const store = useVerseStore(translation, esvKey);
  const shared = lesson.kind === 'shared';
  const codes = store.codes;
  // passages and every list item, in lesson order (journey stops load as you reach them)
  useEffect(() => {
    lesson.steps.forEach((s, i) => {
      if (s.type === 'passage' && s.ref) {
        const sp = spanFromOsis(s.ref);
        if (sp) store.request(`p${i}`, sp);
      } else if (s.type === 'list') {
        listFor(s, lesson)?.items.forEach((it, k) => {
          const sp = spanFromOsis(it.ref);
          if (sp) store.request(`l${i}:${k}`, sp);
        });
      }
    });
  }, [lesson, store.gen]); // eslint-disable-line react-hooks/exhaustive-deps

  // each journey step's stop (starting where the lesson's author chose)
  const [stops, setStops] = useState<Record<number, number>>({});
  const stopAt = (i: number) => {
    const j = journeyFor(lesson.steps[i], lesson);
    const n = j?.stops.length ?? 1;
    return Math.max(0, Math.min(n - 1, stops[i] ?? lesson.steps[i].index ?? 0));
  };
  const setStop = (i: number, k: number) => setStops((m) => ({ ...m, [i]: k }));
  /** while a presenting step scrolls into view, the step in view isn't recomputed */
  const settling = useRef(0);
  const usedLicensed = codes.has(nice(translation)) && isLicensed(translation);

  const goStep = (i: number, smooth = true) => {
    const el = pageRef.current?.querySelector<HTMLElement>(`#ls-step-${i}`);
    el?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'start' });
  };

  // presenting: the arrow keys or a clicker move through a journey's stops, then on to the next step
  useEffect(() => {
    if (!jump.n) return;
    const s = lesson.steps[current];
    const j = s && journeyFor(s, lesson);
    if (j) {
      const next = stopAt(current) + jump.d;
      if (next >= 0 && next < j.stops.length) {
        setStop(current, next);
        return;
      }
    }
    const i = Math.max(0, Math.min(lesson.steps.length - 1, current + jump.d));
    if (i === current) return;
    settling.current = Date.now() + 900;
    onIndex(i);
    goStep(i);
  }, [jump.n]); // eslint-disable-line react-hooks/exhaustive-deps

  // coming back to the lesson: where you were
  useEffect(() => {
    if (props.shown) pageRef.current?.scrollTo({ top: lastTop.current, behavior: 'instant' as ScrollBehavior });
  }, [props.shown]); // eslint-disable-line react-hooks/exhaustive-deps

  // which step is in view (for the side list and while presenting)
  useEffect(() => {
    const page = pageRef.current;
    if (!page) return;
    let raf = 0;
    const onScroll = () => {
      if (page.clientHeight) lastTop.current = page.scrollTop;
      cancelAnimationFrame(raf);
      if (Date.now() < settling.current) return;
      raf = requestAnimationFrame(() => {
        const top = page.getBoundingClientRect().top + 110;
        const secs = [...page.querySelectorAll<HTMLElement>('.ls-step')];
        let at = 0;
        secs.forEach((s, i) => {
          if (s.getBoundingClientRect().top <= top) at = i;
        });
        // at the very bottom, the last step counts as reached
        if (page.scrollTop + page.clientHeight >= page.scrollHeight - 4) at = secs.length - 1;
        onIndex(at);
      });
    };
    page.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => {
      page.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(raf);
    };
  }, [onIndex, lesson.steps.length]);

  return (
    <div className="periods-page lesson-page" ref={pageRef} aria-label={`Lesson: ${lesson.title || 'Lesson'}`}>
      <div className="periods-bar">
        <button className="bar-back" onClick={onClose}>
          ‹ Close lesson
        </button>
        <span className="bar-title">{lesson.title || 'Lesson'}</span>
        {!props.presenting && (
          <button className="btn ls-present" onClick={props.onPresent}>
            Present
          </button>
        )}
      </div>

      <section className="hero people-hero lesson-hero">
        <div className="hero-text">
          <span className="ls-kicker">{shared ? 'Shared lesson' : 'Lesson'}</span>
          <h1>{lesson.title || 'Lesson'}</h1>
          {lesson.summary && <p>{lesson.summary}</p>}
          {shared && (
            <p className="ls-made-by">
              Made by {lesson.author ? <strong>{lesson.author}</strong> : 'someone using Ancient Pathfinder'}, not by the app.
              Please check everything in it with Scripture.
            </p>
          )}
        </div>
      </section>

      <div className="ls-layout">
        <nav className="ls-outline" aria-label="Steps">
          <p className="ls-outline-head">
            {lesson.steps.length} step{lesson.steps.length === 1 ? '' : 's'}
          </p>
          <ol>
            {lesson.steps.map((s, i) => (
              <li key={i} className={i === current ? 'current' : undefined}>
                <button onClick={() => goStep(i)}>
                  <span className="ls-outline-num">{i + 1}</span>
                  <span>{heading(s, lesson)}</span>
                </button>
              </li>
            ))}
          </ol>
        </nav>

        <div className="ls-steps">
          {lesson.steps.map((s, i) => (
            <section key={i} id={`ls-step-${i}`} className={`ls-step ls-${s.type}${i === current && props.presenting ? ' current' : ''}`}>
              <header className="ls-step-head">
                <span className="ls-num">{i + 1}</span>
                <div>
                  <h2>{heading(s, lesson)}</h2>
                  <span className="ls-kind">
                    {STEP_KINDS.find((k) => k.type === s.type)?.label}
                    {s.title && s.type === 'passage' && s.ref ? ` · ${stepSummary(s)}` : ''}
                  </span>
                </div>
              </header>
              <div className="ls-step-body">
                <StepBody step={s} i={i} lesson={lesson} store={store} at={stopAt(i)} setAt={(k) => setStop(i, k)} props={props} />
              </div>
            </section>
          ))}
          {!lesson.steps.length && <p className="muted">This lesson has no steps yet.</p>}

          <footer className="ls-foot">
            {usedLicensed && (
              <p className="copyright-notice small">
                <strong>{nice(translation)}</strong> · {translationNotice(translation)}
                {translation.provider === 'apibible' && (
                  <>
                    {' '}
                    Text provided by{' '}
                    <a href="https://api.bible" target="_blank" rel="noreferrer">
                      API.Bible
                    </a>
                    .
                  </>
                )}
                {translation.provider === 'esv' && (
                  <>
                    {' '}
                    <a href="https://www.esv.org/" target="_blank" rel="noreferrer">
                      ESV.org
                    </a>
                  </>
                )}
              </p>
            )}
            {[...codes].some((c) => c !== nice(translation) || !isLicensed(translation)) && (
              <p className="muted small">
                {[...codes].filter((c) => c !== nice(translation) || !isLicensed(translation)).join(', ')}: public domain.
              </p>
            )}
            {shared && (
              <div className="lesson-shared-tools small">
                {props.signedIn && (
                  <button
                    className="link-button"
                    onClick={async () => {
                      try {
                        await props.onSaveCopy();
                        setMsg('Saved to your My Content.');
                      } catch (e) {
                        setMsg(e instanceof Error ? e.message : 'Couldn’t save a copy.');
                      }
                    }}
                  >
                    Save a copy
                  </button>
                )}
                <button className="link-button" onClick={() => setReporting(true)}>
                  Report this lesson
                </button>
                {props.isAdmin && (
                  <button
                    className="link-button notes-danger"
                    onClick={async () => {
                      if (!confirm('Remove this shared lesson? Its link stops working for everyone. The person who made it keeps their copy.')) return;
                      try {
                        await api('/shared/remove', { id: lesson.id });
                        props.onRemoved();
                      } catch (e) {
                        setMsg(e instanceof Error ? e.message : 'Couldn’t remove it.');
                      }
                    }}
                  >
                    Remove (administrator)
                  </button>
                )}
              </div>
            )}
            {msg && <p className="small acct-ok">{msg}</p>}
            <p>
              <button className="btn" onClick={onClose}>
                Finish the lesson
              </button>
            </p>
          </footer>
        </div>
      </div>
      {reporting && <ReportForm shareId={lesson.id} onClose={() => setReporting(false)} />}
    </div>
  );
}
