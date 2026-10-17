import type { CueType, Point, Route, RouteStep } from '../types';
import { haversineDistanceM } from './geo';

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

/**
 * Searches campus landmarks and OpenStreetMap Nominatim for locations.
 */
export async function searchLocations(
  query: string
): Promise<{ name: string; lat: number; lng: number; subtitle?: string }[]> {
  const cleanQ = query.trim().toLowerCase();
  if (!cleanQ) return [];

  // Match local landmarks first for instant response
  const localMatches = POPULAR_CAMPUS_LANDMARKS.filter(
    (l) => l.name.toLowerCase().includes(cleanQ) || l.category.toLowerCase().includes(cleanQ)
  ).map((l) => ({
    name: l.name,
    lat: l.lat,
    lng: l.lng,
    subtitle: l.category,
  }));

  if (cleanQ.length < 3) {
    return localMatches;
  }

  // Also query OpenStreetMap Nominatim (scoped to College Park / UMD area)
  try {
    const encoded = encodeURIComponent(`${query} College Park`);
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encoded}&limit=5`,
      {
        headers: { 'User-Agent': 'StepSafeAccessibleNav/1.0' },
        signal: AbortSignal.timeout(3000),
      }
    );
    if (res.ok) {
      const places = await res.json();
      if (Array.isArray(places)) {
        const osmResults = places.map((p: { display_name: string; lat: string; lon: string }) => {
          const parts = p.display_name.split(',');
          return {
            name: parts[0],
            subtitle: parts.slice(1, 3).join(',').trim(),
            lat: parseFloat(p.lat),
            lng: parseFloat(p.lon),
          };
        });

        // Combine and dedup
        return [...localMatches, ...osmResults].slice(0, 8);
      }
    }
  } catch (err) {
    console.warn('Nominatim geocode failed or timed out:', err);
  }

  return localMatches;
}

interface OSRMStep {
  name: string;
  distance: number;
  duration: number;
  maneuver: {
    type: string;
    modifier?: string;
    location: [number, number]; // [lng, lat]
    instruction?: string;
  };
}

/**
 * Requests a real walking / footway route between any two points using OSRM Foot Profile.
 */
export async function calculateLiveWalkingRoute(
  start: Point,
  destination: Point,
  destName = 'Custom Destination'
): Promise<Route> {
  const url = `https://router.project-osrm.org/route/v1/foot/${start.lng},${start.lat};${destination.lng},${destination.lat}?overview=full&geometries=geojson&steps=true`;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (res.ok) {
      const data = await res.json();
      if (data.code === 'Ok' && Array.isArray(data.routes) && data.routes.length > 0) {
        const osrmRoute = data.routes[0];
        const coordinates: [number, number][] = osrmRoute.geometry.coordinates; // [lng, lat]
        const totalDistanceM = Math.round(osrmRoute.distance);
        const estMinutes = Math.max(1, Math.round(osrmRoute.distance / 78)); // ~1.3 m/s

        // Map OSRM turn maneuvers to StepSafe steps
        const osrmSteps: OSRMStep[] = osrmRoute.legs?.[0]?.steps || [];
        const steps: RouteStep[] = [];

        let currentDistAlong = 0;
        osrmSteps.forEach((step, idx) => {
          const isLast = idx === osrmSteps.length - 1;
          const loc: Point = {
            lat: step.maneuver.location[1],
            lng: step.maneuver.location[0],
          };

          let cue: CueType = 'caution';
          let instruction = '';

          if (isLast || step.maneuver.type === 'arrive') {
            cue = 'arrived';
            instruction = `You have arrived at ${destName}`;
          } else {
            const mod = (step.maneuver.modifier || '').toLowerCase();
            const street = step.name ? ` onto ${step.name}` : '';

            if (mod.includes('left')) {
              cue = 'left';
              instruction = `Turn left${street}`;
            } else if (mod.includes('right')) {
              cue = 'right';
              instruction = `Turn right${street}`;
            } else if (step.maneuver.type === 'depart') {
              cue = 'caution';
              instruction = `Start walking${street}`;
            } else {
              cue = 'caution';
              instruction = `Continue straight${street}`;
            }
          }

          steps.push({
            index: steps.length,
            cue,
            location: loc,
            trigger_radius_m: 20,
            distance_along_m: Math.round(currentDistAlong),
            instruction,
          });

          currentDistAlong += step.distance;
        });

        // Ensure there is at least an arrival step
        if (steps.length === 0 || steps[steps.length - 1].cue !== 'arrived') {
          steps.push({
            index: steps.length,
            cue: 'arrived',
            location: destination,
            trigger_radius_m: 25,
            distance_along_m: totalDistanceM,
            instruction: `You have arrived at ${destName}`,
          });
        }

        const routeId = `rte_live_${Date.now()}`;
        return {
          id: routeId,
          name: `Live: Walk to ${destName}`,
          distance_m: totalDistanceM,
          est_minutes: estMinutes,
          kind: 'live',
          disclaimer: 'Live OpenStreetMap pedestrian route. Always verify actual sidewalk conditions.',
          geometry: {
            type: 'LineString',
            coordinates,
          },
          steps,
        };
      }
    }
  } catch (err) {
    console.warn('OSRM routing request failed, falling back to direct walkway:', err);
  }

  // Graceful direct pedestrian route fallback if external routing network is offline
  const distM = Math.round(haversineDistanceM(start.lat, start.lng, destination.lat, destination.lng));
  const fallbackCoords: [number, number][] = [
    [start.lng, start.lat],
    [(start.lng + destination.lng) / 2, (start.lat + destination.lat) / 2],
    [destination.lng, destination.lat],
  ];

  return {
    id: `rte_live_direct_${Date.now()}`,
    name: `Live: Direct Walk to ${destName}`,
    distance_m: distM,
    est_minutes: Math.max(1, Math.round(distM / 78)),
    kind: 'live',
    disclaimer: 'Direct walking path estimate. Always verify physical sidewalk accessibility.',
    geometry: {
      type: 'LineString',
      coordinates: fallbackCoords,
    },
    steps: [
      {
        index: 0,
        cue: 'caution',
        location: start,
        trigger_radius_m: 15,
        distance_along_m: 0,
        instruction: `Head toward ${destName}`,
      },
      {
        index: 1,
        cue: 'arrived',
        location: destination,
        trigger_radius_m: 25,
        distance_along_m: distM,
        instruction: `You have arrived at ${destName}`,
      },
    ],
  };
}
