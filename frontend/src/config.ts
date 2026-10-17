import type { AppMeta, CategoryId, Report, Route } from './types';

// Sensor Lab (experimental motion sensing) is hidden for the demo but kept for future work.
// Set to true to bring back the tab and its disclaimer line.
export const SHOW_SENSOR_LAB = false;

export const CATEGORY_INFO: Record<
  CategoryId,
  { label: string; color: string; badgeBg: string; description: string; iconName: string }
> = {
  blocked_sidewalk: {
    label: 'Blocked Sidewalk',
    color: '#ef4444',
    badgeBg: 'rgba(239, 68, 68, 0.15)',
    description: 'Obstacle, parked scooter/car, trash cans, or blocked walkway',
    iconName: 'Ban',
  },
  pothole: {
    label: 'Pothole / Pit',
    color: '#f97316',
    badgeBg: 'rgba(249, 115, 22, 0.15)',
    description: 'Deep hole or depression creating trip or wheel hazard',
    iconName: 'AlertTriangle',
  },
  uneven_surface: {
    label: 'Uneven Surface',
    color: '#eab308',
    badgeBg: 'rgba(234, 179, 8, 0.15)',
    description: 'Cracked, shifted, or raised pavers, tree roots',
    iconName: 'Footprints',
  },
  standing_water: {
    label: 'Standing Water',
    color: '#06b6d4',
    badgeBg: 'rgba(6, 182, 212, 0.15)',
    description: 'Deep puddle, flooding, or slick mud covering walkway',
    iconName: 'Droplets',
  },
  construction_closure: {
    label: 'Construction Closure',
    color: '#ec4899',
    badgeBg: 'rgba(236, 72, 153, 0.15)',
    description: 'Detour, scaffolding, or fence blocking pedestrian route',
    iconName: 'HardHat',
  },
  missing_curb_ramp: {
    label: 'Missing Curb Ramp',
    color: '#8b5cf6',
    badgeBg: 'rgba(139, 92, 246, 0.15)',
    description: 'No drop curb for wheelchair, stroller, or rolling cart',
    iconName: 'Accessibility',
  },
  other: {
    label: 'Other Hazard',
    color: '#64748b',
    badgeBg: 'rgba(100, 116, 139, 0.15)',
    description: 'Low branches, missing lighting, ice, or other barrier',
    iconName: 'HelpCircle',
  },
};

export const DEFAULT_META: AppMeta = {
  categories: Object.entries(CATEGORY_INFO).map(([id, info]) => ({
    id: id as CategoryId,
    label: info.label,
    icon: info.iconName,
    description: info.description,
  })),
  demo_area: {
    name: 'University of Maryland, College Park',
    center: [38.9869, -76.9426],
    bounds: {
      min_lat: 38.975,
      max_lat: 39.0,
      min_lng: -76.96,
      max_lng: -76.925,
    },
  },
  haptic_patterns: {
    left: {
      vibrate_ms: [150, 100, 150],
      text: 'Turn left ahead',
    },
    right: {
      vibrate_ms: [350],
      text: 'Turn right ahead',
    },
    caution: {
      vibrate_ms: [80, 50, 80, 50, 80, 50, 200],
      text: 'Caution: Hazard reported nearby',
    },
    arrived: {
      vibrate_ms: [100, 50, 100, 50, 300],
      text: 'You have reached your destination',
    },
  },
  limits: {
    note_max_length: 280,
    stale_after_days: 5,
  },
};

export const SEEDED_FALLBACK_REPORTS: Report[] = [
  {
    id: 'rpt_seed_001',
    category: 'construction_closure',
    lat: 38.9876,
    lng: -76.9419,
    note: 'Sidewalk fenced off near building entrance with yellow barrier.',
    created_at: new Date(Date.now() - 51 * 3600000).toISOString(),
    status: 'unverified',
    source: 'seed',
    flag_count: 0,
    confirm_count: 3,
    is_stale: false,
    age_hours: 51,
  },
  {
    id: 'rpt_seed_002',
    category: 'pothole',
    lat: 38.9881,
    lng: -76.9437,
    note: 'Deep pothole at the crosswalk edge, trip hazard.',
    created_at: new Date(Date.now() - 20 * 3600000).toISOString(),
    status: 'confirmed',
    source: 'seed',
    flag_count: 0,
    confirm_count: 7,
    is_stale: false,
    age_hours: 20,
  },
  {
    id: 'rpt_seed_003',
    category: 'standing_water',
    lat: 38.9863,
    lng: -76.9445,
    note: 'Puddle after rain covers entire sidewalk width.',
    created_at: new Date(Date.now() - 6 * 3600000).toISOString(),
    status: 'unverified',
    source: 'seed',
    flag_count: 0,
    confirm_count: 2,
    is_stale: false,
    age_hours: 6,
  },
  {
    id: 'rpt_seed_004',
    category: 'missing_curb_ramp',
    lat: 38.9890,
    lng: -76.9452,
    note: 'No ramp at this corner; 6-inch curb step.',
    created_at: new Date(Date.now() - 300 * 3600000).toISOString(),
    status: 'unverified',
    source: 'seed',
    flag_count: 0,
    confirm_count: 5,
    is_stale: true,
    age_hours: 300,
  },
  {
    id: 'rpt_seed_005',
    category: 'uneven_surface',
    lat: 38.9858,
    lng: -76.9431,
    note: 'Raised concrete slab from tree root, ~2 inches up.',
    created_at: new Date(Date.now() - 120 * 3600000).toISOString(),
    status: 'confirmed',
    source: 'seed',
    flag_count: 0,
    confirm_count: 8,
    is_stale: false,
    age_hours: 120,
  },
  {
    id: 'rpt_seed_006',
    category: 'blocked_sidewalk',
    lat: 38.9872,
    lng: -76.9460,
    note: 'Parked electric scooters blocking accessible pathway.',
    created_at: new Date(Date.now() - 3 * 3600000).toISOString(),
    status: 'unverified',
    source: 'seed',
    flag_count: 0,
    confirm_count: 4,
    is_stale: false,
    age_hours: 3,
  },
  {
    id: 'rpt_seed_007',
    category: 'uneven_surface',
    lat: 38.9848,
    lng: -76.9440,
    note: 'Cracked slab with gravel patches.',
    created_at: new Date(Date.now() - 1100 * 3600000).toISOString(),
    status: 'unverified',
    source: 'seed',
    flag_count: 1,
    confirm_count: 1,
    is_stale: true,
    age_hours: 1100,
  },
  {
    id: 'rpt_seed_008',
    category: 'other',
    lat: 38.9895,
    lng: -76.9425,
    note: 'Low-hanging tree branch over the pedestrian path.',
    created_at: new Date(Date.now() - 70 * 3600000).toISOString(),
    status: 'unverified',
    source: 'seed',
    flag_count: 0,
    confirm_count: 3,
    is_stale: false,
    age_hours: 70,
  },
];

function buildRoute(
  id: string,
  name: string,
  path: [number, number][],
  cues: { at_path_index: number; cue: 'left' | 'right' | 'caution' | 'arrived'; instruction: string; trigger_radius_m?: number }[]
): Route {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dist = (c1: [number, number], c2: [number, number]) => {
    const dLat = toRad(c2[1] - c1[1]);
    const dLng = toRad(c2[0] - c1[0]);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(c1[1])) * Math.cos(toRad(c2[1])) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
  };

  const cumulativeDist: number[] = [0];
  let totalM = 0;
  for (let i = 0; i < path.length - 1; i++) {
    totalM += dist(path[i], path[i + 1]);
    cumulativeDist.push(totalM);
  }

  const steps = cues.map((c, idx) => {
    const point = path[Math.min(c.at_path_index, path.length - 1)];
    return {
      index: idx,
      cue: c.cue,
      location: { lat: point[1], lng: point[0] },
      trigger_radius_m: c.trigger_radius_m ?? 20,
      distance_along_m: Math.round(cumulativeDist[Math.min(c.at_path_index, path.length - 1)]),
      instruction: c.instruction,
    };
  });

  return {
    id,
    name,
    distance_m: Math.round(totalM),
    est_minutes: Math.max(1, Math.round(totalM / 78)),
    kind: 'prepared',
    disclaimer: 'Prepared campus demo route for Technica 2026. Watch for nearby sidewalk hazards.',
    geometry: {
      type: 'LineString',
      coordinates: path,
    },
    steps,
  };
}

export const DEMO_PREPARED_ROUTES: Route[] = [
  buildRoute(
    'rte_mckeldin_to_stamp',
    'McKeldin Library to Stamp Student Union',
    [
      [-76.94522, 38.98569],
      [-76.94522, 38.98561],
      [-76.94513, 38.98561],
      [-76.94513, 38.98551],
      [-76.94473, 38.98551],
      [-76.94459, 38.98564],
      [-76.94461, 38.98633],
      [-76.94487, 38.98651],
      [-76.94506, 38.98676],
      [-76.94526, 38.9873],
      [-76.94527, 38.98734],
      [-76.94523, 38.98732],
      [-76.94528, 38.9875],
      [-76.94538, 38.9875],
      [-76.94534, 38.988],
      [-76.94535, 38.9884],
      [-76.9453, 38.98862],
      [-76.94499, 38.98868],
      [-76.94492, 38.98866],
      [-76.94489, 38.98847],
    ],
    [
      { at_path_index: 5, cue: 'left', instruction: 'Turn left and continue along the campus walkway.' },
      { at_path_index: 10, cue: 'right', instruction: 'Turn right and continue toward Stamp Student Union.' },
      { at_path_index: 16, cue: 'right', instruction: 'Turn right toward Stamp Student Union.' },
      { at_path_index: 19, cue: 'arrived', instruction: 'You have reached Stamp Student Union.' },
    ]
  ),
  buildRoute(
    'rte_stamp_to_east_campus',
    'Stamp Student Union to East Campus',
    [
      [-76.94489, 38.98847],
      [-76.94492, 38.98866],
      [-76.94476, 38.98861],
      [-76.94466, 38.98853],
      [-76.94459, 38.98857],
      [-76.94436, 38.98858],
      [-76.94404, 38.9887],
      [-76.94395, 38.98859],
      [-76.94402, 38.98854],
      [-76.94392, 38.98847],
      [-76.94304, 38.98849],
      [-76.94288, 38.98834],
      [-76.94288, 38.98829],
      [-76.94283, 38.9883],
      [-76.94273, 38.98821],
      [-76.94263, 38.98807],
      [-76.94227, 38.98791],
      [-76.94193, 38.98768],
      [-76.94135, 38.98769],
      [-76.94124, 38.98779],
      [-76.94101, 38.98787],
      [-76.9408, 38.98787],
      [-76.94072, 38.98796],
      [-76.94068, 38.98811],
      [-76.94056, 38.98811],
      [-76.94057, 38.98814],
      [-76.94023, 38.98809],
      [-76.93905, 38.98809],
      [-76.93893, 38.98821],
      [-76.9385, 38.98823],
      [-76.9378, 38.98842],
      [-76.93697, 38.98875],
      [-76.93638, 38.9889],
    ],
    [
      { at_path_index: 1, cue: 'right', instruction: 'Turn right and continue along the campus walkway.' },
      { at_path_index: 10, cue: 'right', instruction: 'Turn right and continue toward East Campus.' },
      { at_path_index: 18, cue: 'left', instruction: 'Turn left and continue along the campus walkway.' },
      { at_path_index: 24, cue: 'left', instruction: 'Turn left and continue toward East Campus.' },
      { at_path_index: 32, cue: 'arrived', instruction: 'You have reached East Campus.' },
    ]
  ),
  buildRoute(
    'rte_mckeldin_to_clarice',
    'McKeldin Library to The Clarice',
    [
      [-76.94522, 38.98569],
      [-76.94513, 38.98551],
      [-76.94473, 38.98551],
      [-76.94466, 38.98557],
      [-76.94459, 38.98564],
      [-76.94461, 38.98633],
      [-76.94487, 38.98651],
      [-76.94506, 38.98676],
      [-76.94527, 38.98734],
      [-76.94548, 38.98745],
      [-76.94537, 38.98883],
      [-76.94643, 38.9891],
      [-76.9473, 38.9892],
      [-76.94755, 38.98929],
      [-76.94847, 38.98983],
      [-76.94875, 38.99028],
      [-76.94955, 38.99026],
      [-76.94953, 38.9908],
      [-76.94962, 38.99087],
      [-76.94988, 38.99078],
      [-76.95009, 38.99087],
      [-76.95003, 38.99081],
      [-76.95013, 38.9908],
    ],
    [
      { at_path_index: 10, cue: 'left', instruction: 'Turn left and continue toward The Clarice.' },
      { at_path_index: 16, cue: 'right', instruction: 'Turn right and continue along the campus walkway.' },
      { at_path_index: 19, cue: 'right', instruction: 'Turn right toward The Clarice.' },
      { at_path_index: 22, cue: 'arrived', instruction: 'You have reached The Clarice.' },
    ]
  ),
  buildRoute(
    'rte_stamp_to_eppley',
    'Stamp Student Union to Eppley Recreation Center',
    [
      [-76.94489, 38.98847],
      [-76.94492, 38.98866],
      [-76.94489, 38.98866],
      [-76.94486, 38.98876],
      [-76.94498, 38.98902],
      [-76.94502, 38.98922],
      [-76.94511, 38.98936],
      [-76.94508, 38.98947],
      [-76.94526, 38.98972],
      [-76.94565, 38.98993],
      [-76.9452, 38.99039],
      [-76.94506, 38.99041],
      [-76.94504, 38.99044],
      [-76.94502, 38.99126],
      [-76.94496, 38.99153],
      [-76.94499, 38.99153],
      [-76.94501, 38.99209],
      [-76.94478, 38.9922],
      [-76.94449, 38.99246],
      [-76.94445, 38.99266],
      [-76.94437, 38.99276],
      [-76.94474, 38.993],
      [-76.94506, 38.99302],
      [-76.94506, 38.99341],
    ],
    [
      { at_path_index: 9, cue: 'right', instruction: 'Turn right and continue along the campus walkway.' },
      { at_path_index: 16, cue: 'right', instruction: 'Turn right toward Eppley Recreation Center.' },
      { at_path_index: 20, cue: 'left', instruction: 'Turn left toward Eppley Recreation Center.' },
      { at_path_index: 23, cue: 'arrived', instruction: 'You have reached Eppley Recreation Center.' },
    ]
  ),
  buildRoute(
    'rte_eppley_to_xfinity',
    'Eppley Recreation Center to XFINITY Center',
    [
      [-76.94506, 38.99341],
      [-76.94507, 38.9931],
      [-76.94471, 38.99311],
      [-76.94416, 38.99306],
      [-76.94254, 38.99307],
      [-76.94246, 38.99302],
      [-76.9422, 38.99309],
      [-76.94178, 38.99326],
      [-76.94158, 38.99321],
      [-76.94112, 38.99346],
      [-76.94084, 38.99349],
      [-76.94081, 38.99459],
      [-76.94037, 38.99459],
      [-76.94036, 38.9947],
      [-76.94024, 38.99483],
      [-76.94012, 38.99524],
      [-76.94009, 38.99616],
      [-76.94019, 38.99623],
      [-76.9404, 38.99624],
      [-76.94056, 38.99637],
      [-76.94074, 38.99631],
      [-76.9407, 38.99585],
    ],
    [
      { at_path_index: 5, cue: 'left', instruction: 'Turn left and continue toward XFINITY Center.' },
      { at_path_index: 11, cue: 'right', instruction: 'Turn right and continue along the campus walkway.' },
      { at_path_index: 16, cue: 'left', instruction: 'Turn left toward XFINITY Center.' },
      { at_path_index: 21, cue: 'arrived', instruction: 'You have reached XFINITY Center.' },
    ]
  ),
];
