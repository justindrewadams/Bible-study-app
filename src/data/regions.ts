/** Approximate label positions for biblical-era regions (for orientation only). */
export interface Region {
  name: string;
  lat: number;
  lon: number;
  /** only shown at or above this zoom */
  minZoom: number;
  era?: 'OT' | 'NT';
}

export const REGIONS: Region[] = [
  // Land of Israel, New Testament period
  { name: 'Galilee', lat: 32.82, lon: 35.33, minZoom: 7, era: 'NT' },
  { name: 'Samaria', lat: 32.25, lon: 35.2, minZoom: 7, era: 'NT' },
  { name: 'Judea', lat: 31.6, lon: 35.05, minZoom: 7, era: 'NT' },
  { name: 'Perea', lat: 31.95, lon: 35.72, minZoom: 8, era: 'NT' },
  { name: 'Decapolis', lat: 32.55, lon: 35.95, minZoom: 8, era: 'NT' },
  { name: 'Idumea', lat: 31.2, lon: 34.85, minZoom: 8, era: 'NT' },
  { name: 'Phoenicia', lat: 33.45, lon: 35.35, minZoom: 7 },
  // Old Testament neighbours
  { name: 'Philistia', lat: 31.6, lon: 34.55, minZoom: 8, era: 'OT' },
  { name: 'Moab', lat: 31.3, lon: 35.8, minZoom: 7, era: 'OT' },
  { name: 'Ammon', lat: 31.95, lon: 36.05, minZoom: 8, era: 'OT' },
  { name: 'Edom', lat: 30.55, lon: 35.5, minZoom: 7, era: 'OT' },
  { name: 'Negev', lat: 30.85, lon: 34.85, minZoom: 8 },
  { name: 'Sinai', lat: 29.3, lon: 33.7, minZoom: 6 },
  { name: 'Egypt', lat: 27.5, lon: 30.8, minZoom: 5 },
  { name: 'Aram (Syria)', lat: 34.6, lon: 37.0, minZoom: 6 },
  { name: 'Mesopotamia', lat: 34.5, lon: 41.5, minZoom: 5 },
  { name: 'Babylonia', lat: 32.3, lon: 45.0, minZoom: 5 },
  { name: 'Assyria', lat: 36.3, lon: 43.3, minZoom: 5 },
  { name: 'Arabia', lat: 28.0, lon: 38.5, minZoom: 5 },
  // Roman world
  { name: 'Cilicia', lat: 37.0, lon: 34.8, minZoom: 6, era: 'NT' },
  { name: 'Galatia', lat: 39.3, lon: 32.9, minZoom: 6, era: 'NT' },
  { name: 'Cappadocia', lat: 38.6, lon: 35.4, minZoom: 6, era: 'NT' },
  { name: 'Pamphylia', lat: 37.0, lon: 31.0, minZoom: 7, era: 'NT' },
  { name: 'Lycia', lat: 36.5, lon: 29.6, minZoom: 7, era: 'NT' },
  { name: 'Asia', lat: 38.7, lon: 28.2, minZoom: 6, era: 'NT' },
  { name: 'Bithynia', lat: 40.6, lon: 30.5, minZoom: 6, era: 'NT' },
  { name: 'Macedonia', lat: 40.9, lon: 22.4, minZoom: 6, era: 'NT' },
  { name: 'Achaia', lat: 38.0, lon: 22.2, minZoom: 6, era: 'NT' },
  { name: 'Cyprus', lat: 35.05, lon: 33.2, minZoom: 6 },
  { name: 'Crete', lat: 35.2, lon: 24.9, minZoom: 6 },
  { name: 'Italia', lat: 41.6, lon: 14.5, minZoom: 5, era: 'NT' },
  { name: 'Mare Nostrum (Great Sea)', lat: 34.2, lon: 19.5, minZoom: 4 },
];
