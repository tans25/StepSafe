const EARTH_RADIUS_M = 6371000;

export function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/**
 * Calculates great-circle distance between two (lat, lng) points in meters.
 */
export function haversineDistanceM(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a));
}

type LngLat = [number, number];

/** Running distance (m) from the start of a [lng, lat] path to each vertex. */
export function cumulativeDistancesM(path: LngLat[]): number[] {
  const out = [0];
  for (let i = 1; i < path.length; i++) {
    out.push(out[i - 1] + haversineDistanceM(path[i - 1][1], path[i - 1][0], path[i][1], path[i][0]));
  }
  return out;
}

/** The point `distM` metres along a [lng, lat] path (clamped to its ends). */
export function pointAtDistance(path: LngLat[], cumulative: number[], distM: number): { lat: number; lng: number } {
  const total = cumulative[cumulative.length - 1];
  const d = Math.max(0, Math.min(total, distM));
  let i = 1;
  while (i < cumulative.length - 1 && cumulative[i] < d) i++;
  const segLen = cumulative[i] - cumulative[i - 1];
  const t = segLen === 0 ? 0 : (d - cumulative[i - 1]) / segLen;
  const [aLng, aLat] = path[i - 1];
  const [bLng, bLat] = path[i];
  return { lat: aLat + (bLat - aLat) * t, lng: aLng + (bLng - aLng) * t };
}

/**
 * Closest point on a [lng, lat] path to (lat, lng): its distance from the path and how far along
 * the path it is. Measures to the line segments, not just the vertices (same maths as the backend).
 */
export function projectOntoPath(
  path: LngLat[],
  cumulative: number[],
  lat: number,
  lng: number
): { offset_m: number; distance_along_m: number } {
  let best = { offset_m: Infinity, distance_along_m: 0 };
  for (let i = 0; i < path.length - 1; i++) {
    const [aLng, aLat] = path[i];
    const [bLng, bLat] = path[i + 1];
    const kx = Math.cos(toRad(aLat)) * EARTH_RADIUS_M * (Math.PI / 180);
    const ky = EARTH_RADIUS_M * (Math.PI / 180);
    const bx = (bLng - aLng) * kx;
    const by = (bLat - aLat) * ky;
    const px = (lng - aLng) * kx;
    const py = (lat - aLat) * ky;
    const len2 = bx * bx + by * by;
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, (px * bx + py * by) / len2));
    const offset = Math.hypot(px - t * bx, py - t * by);
    if (offset < best.offset_m) {
      best = { offset_m: offset, distance_along_m: cumulative[i] + t * (cumulative[i + 1] - cumulative[i]) };
    }
  }
  return best;
}

/**
 * Like projectOntoPath, but prefers the part of the path near `hintAlongM` (the walker's last
 * known progress). On a path that doubles back, a GPS fix can be closest to a later section;
 * this keeps progress from jumping ahead or backwards.
 */
export function projectOntoPathNear(
  path: LngLat[],
  cumulative: number[],
  lat: number,
  lng: number,
  hintAlongM: number
): { offset_m: number; distance_along_m: number } {
  let best = { offset_m: Infinity, distance_along_m: 0 };
  let bestScore = Infinity;
  for (let i = 0; i < path.length - 1; i++) {
    const single = projectOntoPath([path[i], path[i + 1]], [cumulative[i], cumulative[i + 1]], lat, lng);
    const score = single.offset_m + 0.25 * Math.abs(single.distance_along_m - hintAlongM);
    if (score < bestScore) {
      bestScore = score;
      best = single;
    }
  }
  return best;
}

export interface Bounds {
  min_lat: number;
  max_lat: number;
  min_lng: number;
  max_lng: number;
}

export function isInBounds(p: { lat: number; lng: number }, b: Bounds): boolean {
  return p.lat >= b.min_lat && p.lat <= b.max_lat && p.lng >= b.min_lng && p.lng <= b.max_lng;
}

/**
 * Formats distance in meters into friendly text.
 */
export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }
  return `${(meters / 1000).toFixed(1)} km`;
}

/**
 * Formats ISO date into human relative time.
 */
export function formatRelativeTime(isoString: string): string {
  const diffMs = Date.now() - new Date(isoString).getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}
