import { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import {
  MapContainer,
  TileLayer,
  CircleMarker,
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
    html: `<svg width="18" height="18" viewBox="0 0 18 18" style="transform:rotate(${-angle}deg)"><path d="M3 3 L16 9 L3 15 L6 9 Z" fill="${color}" stroke="white" stroke-width="1.2" stroke-linejoin="round"/></svg>`,
  });
}

function stopIcon(n: number, color: string, state: 'past' | 'current' | 'future') {
  const size = state === 'current' ? 30 : 22;
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
    html: `<svg width="28" height="40" viewBox="0 0 28 40"><path d="M14 1C7 1 1.5 6.5 1.5 13.5 1.5 23 14 39 14 39S26.5 23 26.5 13.5C26.5 6.5 21 1 14 1Z"/><circle cx="14" cy="13.5" r="5" fill="white"/></svg>`,
  });

/** Moves the camera when the verse focus or the journey stop changes. */
function CameraController({ focus, journey, stopIndex }: Pick<Props, 'focus' | 'journey' | 'stopIndex'>) {
  const map = useMap();
  const lastJourney = useRef<string | null>(null);

  useEffect(() => {
    if (!journey) {
      lastJourney.current = null;
      return;
    }
    if (lastJourney.current !== journey.id) {
      lastJourney.current = journey.id;
      map.flyToBounds(L.latLngBounds(journey.stops.map((s) => [s.lat, s.lon])), { padding: [40, 40], duration: 1 });
      return;
    }
    const cur = journey.stops[stopIndex];
    const pts: L.LatLngExpression[] = stopIndex > 0 ? legPath(journey, stopIndex) : [[cur.lat, cur.lon]];
    const b = L.latLngBounds(pts);
    const zoom = Math.min(map.getBoundsZoom(b.pad(0.6)), 9);
    map.flyTo(b.getCenter(), Math.max(zoom, 5), { duration: 1.1 });
  }, [journey, stopIndex, map]);

  useEffect(() => {
    if (!focus?.places.length) return;
    const b = L.latLngBounds(focus.places.map((p) => [p.lat, p.lon]));
    if (focus.places.length === 1) map.flyTo(b.getCenter(), Math.max(map.getZoom(), 8), { duration: 0.9 });
    else map.flyToBounds(b, { padding: [60, 60], maxZoom: 10, duration: 0.9 });
  }, [focus, map]);

  return null;
}

function RegionLabels({ testament }: { testament: 'OT' | 'NT' }) {
  const map = useMap();
  const [zoom, setZoom] = useState(map.getZoom());
  useMapEvents({ zoomend: () => setZoom(map.getZoom()) });
  return (
    <>
      {REGIONS.filter((r) => (!r.era || r.era === testament) && zoom >= r.minZoom && zoom <= r.minZoom + 5).map((r) => (
        <Marker
          key={r.name}
          position={[r.lat, r.lon]}
          interactive={false}
          keyboard={false}
          icon={L.divIcon({ className: 'region-label', html: `<span>${r.name}</span>`, iconSize: [0, 0] })}
        />
      ))}
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
    m.setLatLng(path[0]);
    const start = performance.now();
    const dur = path.length > 2 ? 1800 : 1100;
    let raf = 0;
    const tick = (t: number) => {
      const k = Math.min(1, (t - start) / dur);
      const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      m.setLatLng(pointAlong(path, e).point);
      if (k < 1) raf = requestAnimationFrame(tick);
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
          <Polyline
            key={`l${leg.i}`}
            positions={leg.positions}
            pathOptions={{
              color: journey.color,
              weight: done ? 4 : 2.5,
              opacity: done ? 0.95 : 0.45,
              dashArray: done ? undefined : '6 8',
              className: leg.i === stopIndex ? 'leg-current' : undefined,
            }}
          />
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
  const focusIds = new Set(focus?.places.map((p) => p.index));

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
      {settings.regions && <RegionLabels testament={testament} />}

      {settings.chapterPlaces &&
        chapterPlaces
          .filter((p) => !focusIds.has(p.index))
          .map((p) => (
            <CircleMarker
              key={p.index}
              center={[p.lat, p.lon]}
              radius={5}
              pathOptions={{ color: '#5b3a1a', weight: 1.5, fillColor: '#f4e4c1', fillOpacity: 0.9 }}
              eventHandlers={{ click: () => onPlaceInfo(p) }}
            >
              <Tooltip direction="top" offset={[0, -4]}>
                {p.name}
              </Tooltip>
            </CircleMarker>
          ))}

      {journey && <JourneyLayer journey={journey} stopIndex={stopIndex} onStopClick={onStopClick} />}

      {focus?.places.map((p) => (
        <FocusMarker
          key={`${p.index}-${p.lat}-${focus.label}`}
          place={p}
          focus={focus}
          onPlaceInfo={onPlaceInfo}
        />
      ))}

      <CameraController focus={focus} journey={journey} stopIndex={stopIndex} />
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
