/** Straight-line ("as the crow flies") distances between places, and rough travel times on foot. */

const EARTH_RADIUS_MILES = 3958.8;
export const KM_PER_MILE = 1.609344;

/** Great-circle distance in miles. */
export function milesBetween(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_MILES * Math.asin(Math.min(1, Math.sqrt(h)));
}

const round = (n: number) => (n < 10 ? Math.round(n * 10) / 10 : Math.round(n)).toLocaleString('en-US');

/** "134 miles (215 km)" */
export function formatDistance(miles: number): { miles: string; km: string; short: string } {
  const m = round(miles);
  const km = round(miles * KM_PER_MILE);
  return { miles: `${m} ${m === '1' ? 'mile' : 'miles'}`, km: `${km} km`, short: `${m} mi` };
}

/** Travellers on foot commonly covered about 20 miles (30 km) a day; roads were longer than a straight line. */
export const MILES_PER_DAY = 20;

export function walkingTime(miles: number): string {
  if (miles < 1) return 'a few minutes on foot';
  if (miles < MILES_PER_DAY * 0.75) {
    const hours = Math.max(1, Math.round(miles / 3));
    return `about ${hours} ${hours === 1 ? 'hour' : 'hours'} on foot`;
  }
  const days = Math.max(1, Math.round(miles / MILES_PER_DAY));
  if (days < 14) return `about ${days} ${days === 1 ? 'day' : 'days'} on foot`;
  const weeks = Math.round(days / 7);
  return `about ${weeks} weeks on foot`;
}
