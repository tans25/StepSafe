const R = 6371000;
const rad = (d: number) => (d * Math.PI) / 180;

/** Great-circle distance in metres. */
export function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = rad(lat2 - lat1);
  const dLng = rad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export type LngLat = [number, number];

/** Cumulative distance in metres from the first vertex to each vertex of a [lng, lat] path. */
export function cumulativeDistancesM(path: LngLat[]): number[] {
  const out = [0];
  for (let i = 1; i < path.length; i++)
    out.push(out[i - 1] + haversineM(path[i - 1][1], path[i - 1][0], path[i][1], path[i][0]));
  return out;
}

/**
 * Closest point on a [lng, lat] polyline to (lat, lng).
 * Returns the sideways offset from the line and the distance along the line, both in metres.
 * Each segment is projected in a flat local frame, which is accurate at campus scale.
 */
export function projectOntoPath(
  path: LngLat[],
  cumulative: number[],
  lat: number,
  lng: number,
): { offset_m: number; distance_along_m: number } {
  let best = { offset_m: Infinity, distance_along_m: 0 };
  for (let i = 0; i < path.length - 1; i++) {
    const [aLng, aLat] = path[i];
    const [bLng, bLat] = path[i + 1];
    const kx = Math.cos(rad(aLat)) * R * (Math.PI / 180);
    const ky = R * (Math.PI / 180);
    const bx = (bLng - aLng) * kx;
    const by = (bLat - aLat) * ky;
    const px = (lng - aLng) * kx;
    const py = (lat - aLat) * ky;
    const len2 = bx * bx + by * by;
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, (px * bx + py * by) / len2));
    const offset = Math.hypot(px - t * bx, py - t * by);
    if (offset < best.offset_m)
      best = { offset_m: offset, distance_along_m: cumulative[i] + t * (cumulative[i + 1] - cumulative[i]) };
  }
  return best;
}
