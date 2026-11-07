import { Component, Fragment, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import L from 'leaflet';
import {
  MapContainer,
  TileLayer,
  Marker,
  Polyline,
  Tooltip,
  useMap,
  useMapEvents,
} from 'react-leaflet';
import type { Place } from '../lib/geo';
import { type Journey, legPath, pointAlong } from '../lib/journeys';
import { REGIONS } from '../data/regions';

export type BaseLayerId = 'terrain' | 'physical' | 'satellite' | 'roman';
export type ModernOverlay = 'off' | 'labels' | 'full';

export interface MapSettings {
  base: BaseLayerId;
  modern: ModernOverlay;
  modernOpacity: number; // 0–1
  regions: boolean;
  chapterPlaces: boolean;
}

export const DEFAULT_MAP_SETTINGS: MapSettings = {
  base: 'terrain',
  modern: 'off',
  modernOpacity: 0.6,
  regions: true,
  chapterPlaces: true,
};

const ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services';

const BASE_LAYERS: Record<BaseLayerId, { label: string; url: string; maxNativeZoom: number; attribution: string; className?: string }> = {
  terrain: {
    label: 'Ancient terrain (no modern labels)',
    url: `${ESRI}/World_Terrain_Base/MapServer/tile/{z}/{y}/{x}`,
    maxNativeZoom: 13,
    attribution: 'Tiles &copy; Esri &mdash; Source: USGS, Esri, TANA, DeLorme, NPS',
    className: 'tiles-parchment',
  },
  physical: {
    label: 'Physical relief',
    url: `${ESRI}/World_Physical_Map/MapServer/tile/{z}/{y}/{x}`,
    maxNativeZoom: 8,
    attribution: 'Tiles &copy; Esri &mdash; Source: US National Park Service',
  },
  satellite: {
    label: 'Satellite',
    url: `${ESRI}/World_Imagery/MapServer/tile/{z}/{y}/{x}`,
    maxNativeZoom: 18,
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics',
  },
  roman: {
    label: 'Roman Empire (roads & ancient names)',
    url: 'https://dh.gu.se/tiles/imperium/{z}/{x}/{y}.png',
    maxNativeZoom: 11,
    attribution:
      '<a href="https://imperium.ahlfeldt.se/">Digital Atlas of the Roman Empire</a> (CC BY 4.0, Johan &Aring;hlfeldt)',
  },
};

export const BASE_LAYER_OPTIONS = Object.entries(BASE_LAYERS).map(([id, b]) => ({ id: id as BaseLayerId, label: b.label }));

const MODERN_LAYERS: Record<Exclude<ModernOverlay, 'off'>, { url: string; maxNativeZoom: number; attribution: string }> = {
  labels: {
    url: `${ESRI}/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}`,
    maxNativeZoom: 13,
    attribution: 'Modern labels &copy; Esri',
  },
  full: {
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    maxNativeZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  },
};

export interface MapFocus {
  places: Place[];
  /** true when the verse names no place and we're showing the last known location */
  inferred: boolean;
  label: string;
}

interface Props {
  settings: MapSettings;
  chapterPlaces: Place[];
  focus: MapFocus | null;
  journey: Journey | null;
  stopIndex: number;
  onStopClick: (i: number) => void;
  /** which era's region names to show */
  testament: 'OT' | 'NT';
  onPlaceInfo: (p: Place) => void;
}

function arrowIcon(angle: number, color: string) {
  // SVG triangle points east; CSS rotation is clockwise, Mercator angle is counter-clockwise.
  return L.divIcon({
    className: 'arrow-icon',
    iconSize: [18, 18],
    iconAnchor: [9, 9],
    html: `<svg width="18" height="18" viewBox="0 0 18 18" style="transform:rotate(${-angle}deg)"><path d="M3 3 L16 9 L3 15 L6 9 Z" fill="${color}" stroke="#111" stroke-width="1.6" stroke-linejoin="round"/></svg>`,
  });
}

function stopIcon(n: number, color: string, state: 'past' | 'current' | 'future') {
  const size = state === 'current' ? 30 : 24;
  return L.divIcon({
    className: `stop-icon stop-${state}`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    html: `<div style="--c:${color};width:${size}px;height:${size}px">${n}</div>`,
  });
}

const travelerIcon = (color: string) =>
  L.divIcon({
    className: 'traveler-icon',
    iconSize: [16, 16],
    iconAnchor: [8, 8],
    html: `<div style="--c:${color}"></div>`,
  });

const focusIcon = (inferred: boolean) =>
  L.divIcon({
    className: `focus-pin${inferred ? ' inferred' : ''}`,
    iconSize: [28, 40],
    iconAnchor: [14, 38],
    popupAnchor: [0, -34],
    html: `<svg width="28" height="40" viewBox="0 0 28 40"><path d="M14 1.5C7.2 1.5 2 6.7 2 13.5 2 22.5 14 38.5 14 38.5S26 22.5 26 13.5C26 6.7 20.8 1.5 14 1.5Z"/><rect x="9.5" y="9" width="9" height="9" fill="#fff" stroke="#111" stroke-width="2"/></svg>`,
  });

/** Moves the camera when the verse focus or the journey stop changes. */
function CameraController({
  focus,
  journey,
  stopIndex,
  chapterPlaces,
}: Pick<Props, 'focus' | 'journey' | 'stopIndex' | 'chapterPlaces'>) {
  const map = useMap();

  // Camera moves need a map with a real size. While the map is hidden (another page is
  // open, or it is still being laid out) a move is held back and run once it has a size;
  // flying a zero-sized map produces NaN coordinates and throws.
  const pending = useRef<(() => void) | null>(null);
  const move = useCallback(
    (fn: () => void) => {
      const size = map.getSize();
      if (!size.x || !size.y) {
        pending.current = fn;
        return;
      }
      try {
        fn();
      } catch (e) {
        console.warn('Map move skipped:', e);
      }
    },
    [map],
  );
  useEffect(() => {
    const ro = new ResizeObserver(() => {
      map.invalidateSize();
      const size = map.getSize();
      if (size.x && size.y && pending.current) {
        const fn = pending.current;
        pending.current = null;
        try {
          fn();
        } catch (e) {
          console.warn('Map move skipped:', e);
        }
      }
    });
    ro.observe(map.getContainer());
    return () => ro.disconnect();
  }, [map]);

  // a new chapter: frame its places (unless a journey or a selected verse is steering)
  const chapterKey = chapterPlaces.map((p) => p.index).join(',');
  useEffect(() => {
    if (journey || focus || !chapterPlaces.length) return;
    const b = L.latLngBounds(chapterPlaces.map((p) => [p.lat, p.lon]));
    move(() => {
      if (chapterPlaces.length === 1) map.flyTo(b.getCenter(), 8, { duration: 0.8 });
      else map.flyToBounds(b, { padding: [50, 50], maxZoom: 10, duration: 0.8 });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapterKey]);
  const lastJourney = useRef<string | null>(null);

  useEffect(() => {
    if (!journey) {
      lastJourney.current = null;
      return;
    }
    if (lastJourney.current !== journey.id) {
      lastJourney.current = journey.id;
      move(() =>
        map.flyToBounds(L.latLngBounds(journey.stops.map((s) => [s.lat, s.lon])), { padding: [40, 40], duration: 1 }),
      );
      return;
    }
    const cur = journey.stops[stopIndex];
    const pts: L.LatLngExpression[] = stopIndex > 0 ? legPath(journey, stopIndex) : [[cur.lat, cur.lon]];
    const b = L.latLngBounds(pts);
    move(() => {
      const zoom = Math.min(map.getBoundsZoom(b.pad(0.6)), 9);
      map.flyTo(b.getCenter(), Math.max(zoom, 5), { duration: 1.1 });
    });
  }, [journey, stopIndex, map, move]);

  useEffect(() => {
    if (!focus?.places.length) return;
    const b = L.latLngBounds(focus.places.map((p) => [p.lat, p.lon]));
    move(() => {
      if (focus.places.length === 1) map.flyTo(b.getCenter(), Math.max(map.getZoom(), 8), { duration: 0.9 });
      else map.flyToBounds(b, { padding: [60, 60], maxZoom: 10, duration: 0.9 });
    });
  }, [focus, map, move]);

  return null;
}

interface Box {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}
const overlaps = (a: Box, b: Box) => a.x1 < b.x2 && a.x2 > b.x1 && a.y1 < b.y2 && a.y2 > b.y1;
const escapeHtml = (t: string) => t.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** Rough label widths in pixels (bold 11px sans for places, 12px spaced caps for regions). */
const placeLabelWidth = (t: string) => t.length * 6.6 + 6;
const regionLabelWidth = (t: string) => t.length * 10.5;

const dotIcon = (label: string | null, count = 1) =>
  L.divIcon({
    className: `place-dot${count > 1 ? ' cluster' : ''}`,
    iconSize: count > 1 ? [18, 18] : [12, 12],
    iconAnchor: count > 1 ? [9, 9] : [6, 6],
    // a leading "<" means the label sits on the left of the square
    html: `<div>${count > 1 ? count : ''}</div>${
      label ? `<span class="${label.startsWith('<') ? 'left' : ''}">${escapeHtml(label.replace(/^</, ''))}</span>` : ''
    }`,
  });

/**
 * Chapter places (outlined squares with name labels) and ancient region names, laid out
 * so labels never overlap: a label that would collide is left off (its square stays),
 * and a region name is dropped when it would sit on a place or repeats a place's name.
 */
function PlaceAndRegionLabels({
  places,
  showRegions,
  testament,
  avoid,
  onPlaceInfo,
}: {
  places: Place[];
  showRegions: boolean;
  testament: 'OT' | 'NT';
  /** points that already have their own marker/label (verse pins, journey stops) */
  avoid: { lat: number; lon: number; pin?: boolean }[];
  onPlaceInfo: (p: Place) => void;
}) {
  const map = useMap();
  const [zoom, setZoom] = useState(map.getZoom());
  useMapEvents({ zoomend: () => setZoom(map.getZoom()) });

  const layout = useMemo(() => {
    const px = (lat: number, lon: number) => map.project([lat, lon], zoom);
    // group squares that would overlap at this zoom into one numbered square
    const groups: { at: L.Point; members: Place[] }[] = [];
    for (const p of places) {
      const pt = px(p.lat, p.lon);
      const g = groups.find((c) => Math.abs(c.at.x - pt.x) < 24 && Math.abs(c.at.y - pt.y) < 22);
      if (g) g.members.push(p);
      else groups.push({ at: pt, members: [p] });
    }
    const taken: Box[] = avoid.map((a) => {
      const p = px(a.lat, a.lon);
      return a.pin
        ? { x1: p.x - 60, y1: p.y - 44, x2: p.x + 60, y2: p.y + 8 } // pin + its name label
        : { x1: p.x - 16, y1: p.y - 16, x2: p.x + 16, y2: p.y + 16 }; // journey stop
    });
    // every square is an obstacle first, so labels don't cover other squares
    const squares = groups.map((g) => ({ x1: g.at.x - 9, y1: g.at.y - 9, x2: g.at.x + 9, y2: g.at.y + 9 }));
    taken.push(...squares);
    const labels = new Map<number, string>(); // group index -> label text
    groups.forEach((g, i) => {
      const text = g.members.length > 1 ? `${g.members[0].name} +${g.members.length - 1}` : g.members[0].name;
      const w = placeLabelWidth(text);
      const right = { x1: g.at.x + 11, y1: g.at.y - 8, x2: g.at.x + 11 + w, y2: g.at.y + 8 };
      const left = { x1: g.at.x - 11 - w, y1: g.at.y - 8, x2: g.at.x - 11, y2: g.at.y + 8 };
      const fits = (box: Box) => !taken.some((b) => b !== squares[i] && overlaps(box, b));
      const box = fits(right) ? right : fits(left) ? left : null;
      if (!box) return;
      taken.push(box);
      labels.set(i, (box === left ? '<' : '') + text);
    });
    const names = new Set(places.map((p) => p.name.toLowerCase()));
    const regions = !showRegions
      ? []
      : REGIONS.filter((r) => {
          if (r.era && r.era !== testament) return false;
          if (zoom < r.minZoom || zoom > r.minZoom + 5) return false;
          if (names.has(r.name.toLowerCase())) return false;
          const pt = px(r.lat, r.lon);
          const w = regionLabelWidth(r.name);
          const box = { x1: pt.x - w / 2, y1: pt.y - 9, x2: pt.x + w / 2, y2: pt.y + 9 };
          if (taken.some((b) => overlaps(box, b))) return false;
          taken.push(box);
          return true;
        });
    return { groups, labels, regions };
  }, [map, zoom, places, showRegions, testament, avoid]);

  return (
    <>
      {layout.regions.map((r) => (
        <Marker
          key={r.name}
          position={[r.lat, r.lon]}
          interactive={false}
          keyboard={false}
          icon={L.divIcon({ className: 'region-label', html: `<span>${r.name}</span>`, iconSize: [0, 0] })}
        />
      ))}
      {layout.groups.map((g, i) => {
        const first = g.members[0];
        const many = g.members.length > 1;
        const label = layout.labels.get(i) ?? null;
        return (
          <Marker
            key={g.members.map((m) => m.index).join('-')}
            position={many ? map.unproject(g.at, zoom) : [first.lat, first.lon]}
            icon={dotIcon(label, g.members.length)}
            title={many ? g.members.map((m) => m.name).join(', ') : `About ${first.name}`}
            eventHandlers={{
              click: () =>
                many
                  ? map.flyToBounds(L.latLngBounds(g.members.map((m) => [m.lat, m.lon])), {
                      padding: [60, 60],
                      maxZoom: Math.max(zoom + 2, 9),
                      duration: 0.8,
                    })
                  : onPlaceInfo(first),
            }}
          >
            {(!label || many) && (
              <Tooltip direction="top" offset={[0, -8]} className="place-tip">
                {many ? `${g.members.map((m) => m.name).join(', ')} (tap to zoom in)` : first.name}
              </Tooltip>
            )}
          </Marker>
        );
      })}
    </>
  );
}

/** Animates a small marker along the most recent leg of the journey. */
function Traveler({ journey, stopIndex }: { journey: Journey; stopIndex: number }) {
  const ref = useRef<L.Marker>(null);
  const prev = useRef({ id: journey.id, index: stopIndex });
  useEffect(() => {
    const m = ref.current;
    const to = journey.stops[stopIndex];
    const from = prev.current.id === journey.id ? journey.stops[prev.current.index] ?? to : to;
    // stepping forward one stop follows the leg's route; any other jump goes straight
    const path: [number, number][] =
      prev.current.id === journey.id && prev.current.index === stopIndex - 1
        ? legPath(journey, stopIndex)
        : [
            [from.lat, from.lon],
            [to.lat, to.lon],
          ];
    prev.current = { id: journey.id, index: stopIndex };
    if (!m) return;
    // only visible while moving, so it never hides the current stop's number
    if (path[0][0] === path[path.length - 1][0] && path[0][1] === path[path.length - 1][1]) {
      m.setOpacity(0);
      return;
    }
    m.setOpacity(1);
    m.setLatLng(path[0]);
    const start = performance.now();
    const dur = path.length > 2 ? 1800 : 1100;
    let raf = 0;
    const tick = (t: number) => {
      const k = Math.min(1, (t - start) / dur);
      const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      m.setLatLng(pointAlong(path, e).point);
      if (k < 1) raf = requestAnimationFrame(tick);
      else m.setOpacity(0);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [journey, stopIndex]);
  const s = journey.stops[stopIndex];
  return <Marker ref={ref} position={[s.lat, s.lon]} icon={travelerIcon(journey.color)} interactive={false} zIndexOffset={2000} />;
}

function JourneyLayer({ journey, stopIndex, onStopClick }: { journey: Journey; stopIndex: number; onStopClick: (i: number) => void }) {
  const legs = useMemo(
    () =>
      journey.stops.slice(1).map((b, i) => {
        const a = journey.stops[i];
        const same = a.lat === b.lat && a.lon === b.lon && !b.via;
        const positions = legPath(journey, i + 1);
        const { point, angle } = pointAlong(positions, 0.55);
        return { i: i + 1, same, positions: positions as L.LatLngTuple[], mid: point as L.LatLngTuple, angle };
      }),
    [journey],
  );

  return (
    <>
      {legs.map((leg) => {
        if (leg.same) return null;
        const done = leg.i <= stopIndex;
        return (
          <Fragment key={`l${leg.i}`}>
            {/* dark outline under travelled legs; always mounted so it stays beneath the colored line */}
            <Polyline
              positions={leg.positions}
              interactive={false}
              pathOptions={{ color: '#111', weight: 8, opacity: done ? 1 : 0, lineCap: 'square', lineJoin: 'miter' }}
            />
            <Polyline
              positions={leg.positions}
              interactive={false}
              pathOptions={{
                color: journey.color,
                weight: done ? 4.5 : 3,
                opacity: done ? 1 : 0.75,
                dashArray: done ? undefined : '2 9',
                lineCap: done ? 'square' : 'round',
                lineJoin: 'miter',
                className: leg.i === stopIndex ? 'leg-current' : undefined,
              }}
            />
          </Fragment>
        );
      })}
      {legs.map((leg) =>
        leg.same || leg.i > stopIndex ? null : (
          <Marker key={`a${leg.i}`} position={leg.mid} icon={arrowIcon(leg.angle, journey.color)} interactive={false} />
        ),
      )}
      {journey.stops.map((s, i) => {
        const state = i < stopIndex ? 'past' : i === stopIndex ? 'current' : 'future';
        return (
          <Marker
            key={`s${i}`}
            position={[s.lat, s.lon]}
            icon={stopIcon(i + 1, journey.color, state)}
            zIndexOffset={state === 'current' ? 1000 : i}
            eventHandlers={{ click: () => onStopClick(i) }}
          >
            <Tooltip direction="top" offset={[0, -12]}>
              <strong>
                {i + 1}. {s.place}
              </strong>
              <br />
              {s.ref.replace(/\./, ' ').replace(/\./, ':')}
            </Tooltip>
          </Marker>
        );
      })}
      <Traveler journey={journey} stopIndex={stopIndex} />
    </>
  );
}

export default function MapView({
  settings,
  chapterPlaces,
  focus,
  journey,
  stopIndex,
  onStopClick,
  testament,
  onPlaceInfo,
}: Props) {
  const base = BASE_LAYERS[settings.base];
  const modern = settings.modern !== 'off' ? MODERN_LAYERS[settings.modern] : null;
  const focusKey = focus?.places.map((p) => p.index).join(',') ?? '';
  const shownPlaces = useMemo(() => {
    const ids = new Set(focusKey.split(',').filter(Boolean).map(Number));
    return chapterPlaces.filter((p) => !ids.has(p.index));
  }, [chapterPlaces, focusKey]);
  // spots that already carry their own marker and label
  const avoid = useMemo(
    () => [
      ...(focus?.places ?? []).map((p) => ({ lat: p.lat, lon: p.lon, pin: true })),
      ...(journey?.stops ?? []).map((st) => ({ lat: st.lat, lon: st.lon })),
    ],
    [focus, journey],
  );

  return (
    <MapContainer center={[31.78, 35.23]} zoom={7} minZoom={3} maxZoom={16} className="map" worldCopyJump>
      <TileLayer
        key={settings.base}
        url={base.url}
        maxNativeZoom={base.maxNativeZoom}
        maxZoom={16}
        attribution={base.attribution}
        className={base.className}
      />
      {modern && (
        <TileLayer
          key={settings.modern}
          url={modern.url}
          maxNativeZoom={modern.maxNativeZoom}
          maxZoom={16}
          opacity={settings.modernOpacity}
          attribution={modern.attribution}
          zIndex={5}
        />
      )}
      <PlaceAndRegionLabels
        places={settings.chapterPlaces ? shownPlaces : []}
        showRegions={settings.regions}
        testament={testament}
        avoid={avoid}
        onPlaceInfo={onPlaceInfo}
      />

      {journey && <JourneyLayer journey={journey} stopIndex={stopIndex} onStopClick={onStopClick} />}

      {focus?.places.map((p) => (
        <FocusMarker
          key={`${p.index}-${p.lat}-${focus.label}`}
          place={p}
          focus={focus}
          onPlaceInfo={onPlaceInfo}
        />
      ))}

      <CameraController focus={focus} journey={journey} stopIndex={stopIndex} chapterPlaces={chapterPlaces} />
    </MapContainer>
  );
}

function FocusMarker({
  place,
  focus,
  onPlaceInfo,
}: {
  place: Place;
  focus: MapFocus;
  onPlaceInfo: (p: Place) => void;
}) {
  // Tapping the pin opens the full place card directly; a small label names the place.
  const hasCard = place.index >= 0;
  return (
    <Marker
      position={[place.lat, place.lon]}
      icon={focusIcon(focus.inferred)}
      zIndexOffset={3000}
      interactive={hasCard}
      title={hasCard ? `About ${place.name}` : place.name}
      eventHandlers={hasCard ? { click: () => onPlaceInfo(place) } : undefined}
    >
      <Tooltip
        permanent
        interactive={hasCard}
        eventHandlers={hasCard ? { click: () => onPlaceInfo(place) } : undefined}
        direction="top"
        offset={[0, -38]}
        className={`pin-label${focus.inferred ? ' inferred' : ''}`}
      >
        {place.name}
        {focus.inferred && <span className="pin-label-sub"> · last mentioned</span>}
      </Tooltip>
    </Marker>
  );
}

/** Keeps a map failure from taking down the whole app; offers a retry instead. */
export class MapErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    console.warn('Map error:', error);
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="map map-failed">
        <p>The map hit a problem.</p>
        <button className="btn" onClick={() => this.setState({ failed: false })}>
          Reload map
        </button>
      </div>
    );
  }
}
