import { DEFAULT_META } from '../config';
import type { CueType, Point, Route, RouteStep } from '../types';
import { haversineDistanceM, isInBounds } from './geo';

export interface CampusLandmark {
  name: string;
  category: string;
  lat: number;
  lng: number;
}

export const POPULAR_CAMPUS_LANDMARKS: CampusLandmark[] = [
  {
    name: 'Brendan Iribe Center for Computer Science',
    category: 'Academic',
    lat: 38.98928,
    lng: -76.93662,
  },
  {
    name: 'McKeldin Library & Mall',
    category: 'Library',
    lat: 38.98569,
    lng: -76.94522,
  },
  {
    name: 'Stamp Student Union',
    category: 'Student Life',
    lat: 38.98847,
    lng: -76.94489,
  },
  {
    name: 'Eppley Recreation Center (ERC)',
    category: 'Athletics & Gym',
    lat: 38.99341,
    lng: -76.94506,
  },
  {
    name: 'The Clarice Smith Performing Arts Center',
    category: 'Arts',
    lat: 38.9908,
    lng: -76.95013,
  },
  {
    name: 'XFINITY Center',
    category: 'Arena',
    lat: 38.99585,
    lng: -76.9407,
  },
  {
    name: 'Edward St. John Learning Center (ESJ)',
    category: 'Academic',
    lat: 38.9864,
    lng: -76.9416,
  },
  {
    name: 'Hornbake Library & Plaza',
    category: 'Library',
    lat: 38.988,
    lng: -76.9422,
  },
  {
    name: 'The Armory',
    category: 'Academic / Events',
    lat: 38.9842,
    lng: -76.9415,
  },
  {
    name: 'Memorial Chapel',
    category: 'Landmark',
    lat: 38.9863,
    lng: -76.9402,
  },
  {
    name: 'A. James Clark Hall (Bioengineering)',
    category: 'Engineering',
    lat: 38.9902,
    lng: -76.9378,
  },
  {
    name: 'Kim Engineering Building',
    category: 'Engineering',
    lat: 38.9911,
    lng: -76.9385,
  },
  {
    name: 'College Park Metro Station',
    category: 'Transit',
    lat: 38.9786,
    lng: -76.9284,
  },
];

export interface PlaceResult {
  name: string;
  subtitle?: string;
  lat: number;
  lng: number;
}

/** True if a point is inside the demo area (reports, hazards and routing are limited to it). */
export function isInDemoArea(p: Point): boolean {
  return isInBounds(p, DEFAULT_META.demo_area.bounds);
}

/** Instant, offline search over the built-in campus landmarks (safe to run on every keystroke). */
export function searchLandmarks(query: string): PlaceResult[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return POPULAR_CAMPUS_LANDMARKS.filter(
    (l) => l.name.toLowerCase().includes(q) || l.category.toLowerCase().includes(q)
  ).map((l) => ({ name: l.name, subtitle: l.category, lat: l.lat, lng: l.lng }));
}

/**
 * Searches OpenStreetMap Nominatim, restricted to the demo area.
 * Nominatim's usage policy forbids search-as-you-type, so call this only on an explicit
 * search (Enter / button), never from a keystroke handler.
 */
export async function searchPlaces(query: string): Promise<PlaceResult[]> {
  const q = query.trim();
  if (q.length < 3) return [];

  const b = DEFAULT_META.demo_area.bounds;
  const params = new URLSearchParams({
    format: 'json',
    q,
    limit: '6',
    viewbox: `${b.min_lng},${b.max_lat},${b.max_lng},${b.min_lat}`,
    bounded: '1',
  });

  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return [];
    const places = await res.json();
    if (!Array.isArray(places)) return [];
    return places
      .map((p: { display_name: string; lat: string; lon: string }) => {
        const parts = p.display_name.split(',');
        return {
          name: parts[0],
          subtitle: parts.slice(1, 3).join(',').trim(),
          lat: parseFloat(p.lat),
          lng: parseFloat(p.lon),
        };
      })
      .filter((p) => isInDemoArea(p));
  } catch (err) {
    console.warn('Nominatim search failed or timed out:', err);
    return [];
  }
}

interface OSRMStep {
  name: string;
  distance: number;
  duration: number;
  maneuver: {
    type: string;
    modifier?: string;
    location: [number, number]; // [lng, lat]
  };
}

// FOSSGIS's public OSRM server with the foot profile. (router.project-osrm.org only has a car
// profile and silently ignores /foot/, which gave road routes with driving times.)
const FOOT_ROUTER_URL = 'https://routing.openstreetmap.de/routed-foot/route/v1/foot';

const WALKING_SPEED_M_PER_MIN = 78; // ~1.3 m/s

/**
 * Requests a real walking route between two points in the demo area.
 * Only turns become cues: "continue"/"depart" steps get no haptic, because the caution
 * pattern is reserved for reported hazards.
 */
export async function calculateLiveWalkingRoute(
  start: Point,
  destination: Point,
  destName = 'Selected Location'
): Promise<Route> {
  const url = `${FOOT_ROUTER_URL}/${start.lng},${start.lat};${destination.lng},${destination.lat}?overview=full&geometries=geojson&steps=true`;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (res.ok) {
      const data = await res.json();
      if (data.code === 'Ok' && Array.isArray(data.routes) && data.routes.length > 0) {
        const osrmRoute = data.routes[0];
        const coordinates: [number, number][] = osrmRoute.geometry.coordinates; // [lng, lat]
        const totalDistanceM = Math.round(osrmRoute.distance);
        const osrmSteps: OSRMStep[] = osrmRoute.legs?.[0]?.steps || [];
        const steps: RouteStep[] = [];

        let distAlong = 0;
        for (const step of osrmSteps) {
          const { type, modifier = '' } = step.maneuver;
          const turn = type === 'depart' || type === 'arrive' ? null : turnCue(modifier);
          if (turn) {
            const street = step.name ? ` onto ${step.name}` : '';
            steps.push({
              index: steps.length,
              cue: turn,
              location: { lat: step.maneuver.location[1], lng: step.maneuver.location[0] },
              trigger_radius_m: 20,
              distance_along_m: Math.round(distAlong),
              instruction: `Turn ${turn}${street}`,
            });
          }
          distAlong += step.distance;
        }

        // Merge jogs, and drop turns right at the destination (they'd buzz just before "arrived").
        const turns = mergeCloseTurns(steps).filter((s) => s.distance_along_m < totalDistanceM - ARRIVAL_SKIP_TURNS_M);
        steps.splice(0, steps.length, ...turns.map((s, i) => ({ ...s, index: i })));
        steps.push(arrivalStep(steps.length, destination, totalDistanceM, destName));

        return {
          id: `rte_live_${Date.now()}`,
          name: `Walk to ${destName}`,
          distance_m: totalDistanceM,
          est_minutes: Math.max(1, Math.round(totalDistanceM / WALKING_SPEED_M_PER_MIN)),
          kind: 'live',
          disclaimer:
            'Live walking route from OpenStreetMap data. It may not reflect closures, curb ramps or surface conditions. Rely on your own judgment.',
          geometry: { type: 'LineString', coordinates },
          steps,
        };
      }
    }
  } catch (err) {
    console.warn('Walking route request failed, falling back to a straight line:', err);
  }

  // Fallback if the routing service is unreachable: a straight line, clearly labelled as such.
  const distM = Math.round(haversineDistanceM(start.lat, start.lng, destination.lat, destination.lng));
  return {
    id: `rte_live_direct_${Date.now()}`,
    name: `Straight line to ${destName}`,
    distance_m: distM,
    est_minutes: Math.max(1, Math.round(distM / WALKING_SPEED_M_PER_MIN)),
    kind: 'live',
    disclaimer:
      'Routing service unavailable: this is a straight line, not a walkable path. Do not follow it literally.',
    geometry: {
      type: 'LineString',
      coordinates: [
        [start.lng, start.lat],
        [destination.lng, destination.lat],
      ],
    },
    steps: [arrivalStep(0, destination, distM, destName)],
  };
}

// Turns closer together than this can't be told apart while walking (GPS is only accurate to
// ~5-15 m), and footpath data is full of tiny jogs ("right, 5 m, left").
const MERGE_TURNS_WITHIN_M = 12;
const ARRIVAL_SKIP_TURNS_M = 15;

/**
 * Simplifies turns that are too close together: a right-then-left (or left-then-right) jog
 * cancels out and both are dropped; two turns the same way keep only the first.
 */
function mergeCloseTurns(turns: RouteStep[]): RouteStep[] {
  const kept: RouteStep[] = [];
  for (const turn of turns) {
    const prev = kept[kept.length - 1];
    if (prev && turn.distance_along_m - prev.distance_along_m < MERGE_TURNS_WITHIN_M) {
      if (prev.cue !== turn.cue) kept.pop(); // opposite jog: net straight
      continue;
    }
    kept.push(turn);
  }
  return kept.map((s, i) => ({ ...s, index: i }));
}

function turnCue(modifier: string): CueType | null {
  const m = modifier.toLowerCase();
  if (m === 'uturn') return null;
  if (m.includes('left')) return 'left';
  if (m.includes('right')) return 'right';
  return null;
}

function arrivalStep(index: number, destination: Point, distanceAlongM: number, destName: string): RouteStep {
  return {
    index,
    cue: 'arrived',
    location: destination,
    trigger_radius_m: 25,
    distance_along_m: distanceAlongM,
    instruction: `You have arrived at ${destName}`,
  };
}
