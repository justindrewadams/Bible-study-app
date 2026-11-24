import { useEffect, useMemo, useState } from 'react';
import L from 'leaflet';
import { Marker, Pane, Polygon, Polyline, useMap, useMapEvents } from 'react-leaflet';

/**
 * Jerusalem in Jesus' day, drawn on the map for the city close-up: walls, valleys, the temple platform,
 * the Antonia, Herod's palace and the pools, with names that open the Jerusalem page.
 *
 * Drawn for this app from the general layout of the first-century city (like the plans on the Jerusalem
 * page); every line is approximate. Inside CITY_BOUNDS the map may zoom past its usual limit, so walks
 * of a few hundred yards (the upper room to Gethsemane) can be followed.
 */

type LL = [number, number];

/** Where the extra-close zoom is allowed: the city, the Mount of Olives and Bethany. */
export const CITY_BOUNDS = L.latLngBounds([31.755, 35.205], [31.8, 35.272]);
export const CITY_MAX_ZOOM = 16;
/** the plan appears from this zoom in */
const SHOW_FROM = 12;

const TEMPLE: LL[] = [
  [31.7808, 35.2344],
  [31.7801, 35.2372],
  [31.7757, 35.2366],
  [31.7761, 35.2343],
];
const ANTONIA: LL[] = [
  [31.7813, 35.2336],
  [31.7813, 35.2349],
  [31.7806, 35.2349],
  [31.7806, 35.2336],
];
const PALACE: LL[] = [
  [31.7772, 35.2275],
  [31.7772, 35.2289],
  [31.7746, 35.2289],
  [31.7746, 35.2275],
];
/** the first wall: around the upper city and the City of David, joining the temple */
const FIRST_WALL: LL[] = [
  [31.7774, 35.2343],
  [31.7773, 35.2295],
  [31.7772, 35.2275],
  [31.774, 35.2271],
  [31.7712, 35.2275],
  [31.77, 35.229],
  [31.769, 35.2318],
  [31.7692, 35.2345],
  [31.7697, 35.2357],
  [31.772, 35.2368],
  [31.7745, 35.237],
  [31.7757, 35.2366],
];
/** the second wall: around the northern quarter, from near the Gennath gate to the Antonia (Golgotha outside) */
const SECOND_WALL: LL[] = [
  [31.7773, 35.2305],
  [31.779, 35.231],
  [31.78, 35.2322],
  [31.7806, 35.2338],
];
const KIDRON: LL[] = [
  [31.786, 35.2385],
  [31.782, 35.2382],
  [31.779, 35.238],
  [31.776, 35.2377],
  [31.773, 35.2375],
  [31.77, 35.2368],
  [31.7672, 35.2362],
  [31.765, 35.2375],
];
const HINNOM: LL[] = [
  [31.777, 35.2245],
  [31.774, 35.2252],
  [31.7712, 35.2258],
  [31.7692, 35.2275],
  [31.768, 35.2305],
  [31.7676, 35.234],
  [31.7672, 35.2362],
];
const TYROPOEON: LL[] = [
  [31.7815, 35.232],
  [31.779, 35.233],
  [31.7765, 35.2337],
  [31.7735, 35.2343],
  [31.771, 35.235],
  [31.7697, 35.2356],
];
const square = ([lat, lon]: LL, d: number): LL[] => [
  [lat + d, lon - d * 1.18],
  [lat + d, lon + d * 1.18],
  [lat - d, lon + d * 1.18],
  [lat - d, lon - d * 1.18],
];
const POOLS: LL[][] = [square([31.7697, 35.2354], 0.00018), square([31.7817, 35.2357], 0.00022)];

interface Label {
  at: LL;
  text: string;
  spot?: string;
  kind: 'area' | 'valley' | 'site';
  from: number;
}
const LABELS: Label[] = [
  { at: [31.7797, 35.2352], text: 'Temple', spot: 'temple-mount', kind: 'area', from: 12 },
  { at: [31.7806, 35.2445], text: 'Mount of Olives', spot: 'olives', kind: 'area', from: 12 },
  { at: [31.7735, 35.2303], text: 'Upper City', spot: 'upper-city', kind: 'area', from: 13 },
  { at: [31.7722, 35.2357], text: 'City of David', spot: 'lower-city', kind: 'area', from: 14 },
  { at: [31.7742, 35.2387], text: 'Kidron Valley', spot: 'kidron', kind: 'valley', from: 13 },
  { at: [31.7676, 35.2292], text: 'Hinnom Valley', spot: 'hinnom', kind: 'valley', from: 13 },
  { at: [31.7752, 35.234], text: 'Tyropoeon Valley', kind: 'valley', from: 15 },
  { at: [31.7816, 35.2335], text: 'Antonia', spot: 'antonia', kind: 'site', from: 14 },
  { at: [31.7752, 35.2262], text: 'Herod’s palace', spot: 'herods-palace', kind: 'site', from: 14 },
  { at: [31.7693, 35.2356], text: 'Pool of Siloam', spot: 'siloam', kind: 'site', from: 14 },
  { at: [31.7821, 35.2357], text: 'Pool of Bethesda', spot: 'bethesda', kind: 'site', from: 14 },
];

const labelIcon = (l: Label) =>
  L.divIcon({
    className: `city-label city-${l.kind}${l.spot ? ' linked' : ''}`,
    iconSize: [0, 0],
    html: `<span>${l.text}</span>`,
  });

export default function CityPlanLayer({ baseMaxZoom, onOpenSpot }: { baseMaxZoom: number; onOpenSpot?: (id: string) => void }) {
  const map = useMap();
  const [zoom, setZoom] = useState(() => map.getZoom());
  useMapEvents({ zoomend: () => setZoom(map.getZoom()) });

  // allow the extra-close zoom only while looking at Jerusalem
  useEffect(() => {
    const check = () => {
      const want = CITY_BOUNDS.contains(map.getCenter()) ? CITY_MAX_ZOOM : baseMaxZoom;
      if (map.getMaxZoom() !== want) map.setMaxZoom(want);
    };
    check();
    map.on('moveend', check);
    return () => {
      map.off('moveend', check);
    };
  }, [map, baseMaxZoom]);

  const icons = useMemo(() => new Map(LABELS.map((l) => [l.text, labelIcon(l)])), []);
  if (zoom < SHOW_FROM) return null;

  const w = (base: number) => base * Math.max(0.6, Math.min(1.6, (zoom - 11) / 2.5));
  const wall = { color: '#4a3a28', weight: w(4), opacity: 0.85, lineCap: 'square' as const, lineJoin: 'miter' as const };
  const valley = { color: '#5f7f99', weight: w(12), opacity: 0.28, lineCap: 'round' as const, lineJoin: 'round' as const };

  return (
    <>
      <Pane name="city" style={{ zIndex: 380 }}>
        {[KIDRON, HINNOM, TYROPOEON].map((v, i) => (
          <Polyline key={`v${i}`} positions={v} interactive={false} pathOptions={valley} />
        ))}
        <Polygon
          positions={TEMPLE}
          interactive={false}
          pathOptions={{ color: '#111', weight: w(2), fillColor: '#d9b866', fillOpacity: 0.55 }}
        />
        {[ANTONIA, PALACE].map((p, i) => (
          <Polygon
            key={`b${i}`}
            positions={p}
            interactive={false}
            pathOptions={{ color: '#111', weight: w(1.5), fillColor: '#a8916b', fillOpacity: 0.6 }}
          />
        ))}
        {POOLS.map((p, i) => (
          <Polygon key={`p${i}`} positions={p} interactive={false} pathOptions={{ color: '#111', weight: 1, fillColor: '#5b8fb9', fillOpacity: 0.85 }} />
        ))}
        <Polyline positions={FIRST_WALL} interactive={false} pathOptions={wall} />
        <Polyline positions={SECOND_WALL} interactive={false} pathOptions={{ ...wall, weight: w(3), dashArray: '8 6' }} />
      </Pane>
      <Pane name="cityLabels" style={{ zIndex: 590 }}>
        {LABELS.filter((l) => zoom >= l.from).map((l) => (
          <Marker
            key={l.text}
            position={l.at}
            icon={icons.get(l.text)!}
            interactive={!!(l.spot && onOpenSpot)}
            keyboard={false}
            title={l.spot ? `${l.text}: about this place` : undefined}
            eventHandlers={l.spot && onOpenSpot ? { click: () => onOpenSpot(l.spot!) } : undefined}
          />
        ))}
      </Pane>
    </>
  );
}
