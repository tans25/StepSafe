// =============================================================================
// PREPARED DEMO ROUTES  (you fill this in)
// =============================================================================
// Same role as seedData.ts for reports: this is the data the route loader will
// read. Edit the entries in SEED_ROUTES below. You only write the human-decided
// parts; the loader computes everything else (distance, walking time, distance
// along the route for each cue, trigger radius) and builds the API's Route shape.
//
// HOW TO GET THE COORDINATES
//   1. Open https://geojson.io (or any map where you can click points).
//   2. Switch to a map layer that shows OpenStreetMap footpaths/sidewalks.
//   3. Click the line tool and click along the real walkway, one point every
//      10-30 m and one at EVERY corner or bend. Stay on sidewalks and paths,
//      not across lawns, buildings or roads.
//   4. Copy the coordinates from the GeoJSON panel into `path` below.
//   5. Ideally walk the route (or check it against a satellite view) before demo.
//
// COORDINATE ORDER:  [longitude, latitude]  -- LNG FIRST (GeoJSON order).
//   For UMD, longitude is about -76.94 and latitude about 38.98.
//   If your numbers look like [38.98, -76.94] they are the wrong way round.
//   Points must lie inside the demo area: lat 38.975..39.000, lng -76.960..-76.925.
//
// GOOD DEMO ROUTE: 3-6 turns, 300-800 m long, and it should pass within ~25 m
// of at least one hazard in seedData.ts so the "warnings along route" demo shows
// something. Make at least 2 routes if you can.
// =============================================================================

export type CueType = "left" | "right" | "caution" | "arrived";

export interface SeedCue {
  /** Index into `path` (0 = first point) where this cue fires. Must be a real index. */
  at_path_index: number;
  /** left | right | caution | arrived. Last cue of every route should be "arrived". */
  cue: CueType;
  /** Text shown to the user for this cue; also the non-vibration alternative. Say what to do, e.g. "Turn left onto the path beside the library". */
  instruction: string;
  /** OPTIONAL. Metres before the point at which the cue fires. Leave out to use the default (20). Use 30-40 for fast or wide turns. */
  trigger_radius_m?: number;
}

export interface SeedRoute {
  /** Unique id, lowercase, no spaces. Must start with "rte_". Used in URLs: /api/routes/<id>. */
  id: string;
  /** Short name shown in the route list, e.g. "McKeldin Mall to Stamp Student Union". */
  name: string;
  /**
    * Keep `true` until someone has checked the route on foot. The loader skips
    * routes with draft: true, so unverified directions never reach the API.
   */
  draft: boolean;
  /** Ordered walking line, [lng, lat] pairs, start to finish. At least 2 points. */
  path: [number, number][];
  /** Cue points along the path, in walking order. Don't create cues for hazards here; those come from reports automatically. */
  cues: SeedCue[];
}

// Route traces use OpenStreetMap footway data (© OpenStreetMap contributors, ODbL).
export const SEED_ROUTES: SeedRoute[] = [
  {
    id: "rte_mckeldin_to_stamp",
    name: "McKeldin Library to Stamp Student Union",
    draft: true,
    path: [
      [-76.94522, 38.98569],
      [-76.94522, 38.98561],
      [-76.94513, 38.98561],
      [-76.94513, 38.98551],
      [-76.94473, 38.98551],
      [-76.94459, 38.98564],
      [-76.94461, 38.98633],
      [-76.94487, 38.98651],
      [-76.94506, 38.98676],
      [-76.94526, 38.98730],
      [-76.94527, 38.98734],
      [-76.94523, 38.98732],
      [-76.94528, 38.98750],
      [-76.94538, 38.98750],
      [-76.94534, 38.98800],
      [-76.94535, 38.98840],
      [-76.94530, 38.98862],
      [-76.94499, 38.98868],
      [-76.94492, 38.98866],
      [-76.94489, 38.98847],
    ],
    cues: [
      { at_path_index: 5, cue: "left", instruction: "Turn left and continue along the campus walkway." },
      { at_path_index: 10, cue: "right", instruction: "Turn right and continue toward Stamp Student Union." },
      { at_path_index: 16, cue: "right", instruction: "Turn right toward Stamp Student Union." },
      { at_path_index: 19, cue: "arrived", instruction: "You have reached Stamp Student Union." },
    ],
  },
  {
    id: "rte_stamp_to_east_campus",
    name: "Stamp Student Union to East Campus",
    draft: true,
    path: [
      [-76.94489, 38.98847],
      [-76.94492, 38.98866],
      [-76.94476, 38.98861],
      [-76.94466, 38.98853],
      [-76.94459, 38.98857],
      [-76.94436, 38.98858],
      [-76.94404, 38.98870],
      [-76.94395, 38.98859],
      [-76.94402, 38.98854],
      [-76.94392, 38.98847],
      [-76.94304, 38.98849],
      [-76.94288, 38.98834],
      [-76.94288, 38.98829],
      [-76.94283, 38.98830],
      [-76.94273, 38.98821],
      [-76.94263, 38.98807],
      [-76.94227, 38.98791],
      [-76.94193, 38.98768],
      [-76.94135, 38.98769],
      [-76.94124, 38.98779],
      [-76.94101, 38.98787],
      [-76.94080, 38.98787],
      [-76.94072, 38.98796],
      [-76.94068, 38.98811],
      [-76.94056, 38.98811],
      [-76.94057, 38.98814],
      [-76.94023, 38.98809],
      [-76.93905, 38.98809],
      [-76.93893, 38.98821],
      [-76.93850, 38.98823],
      [-76.93780, 38.98842],
      [-76.93697, 38.98875],
      [-76.93638, 38.98890],
    ],
    cues: [
      { at_path_index: 1, cue: "right", instruction: "Turn right and continue along the campus walkway." },
      { at_path_index: 10, cue: "right", instruction: "Turn right and continue toward East Campus." },
      { at_path_index: 18, cue: "left", instruction: "Turn left and continue along the campus walkway." },
      { at_path_index: 24, cue: "left", instruction: "Turn left and continue toward East Campus." },
      { at_path_index: 32, cue: "arrived", instruction: "You have reached East Campus." },
    ],
  },
  {
    id: "rte_mckeldin_to_clarice",
    name: "McKeldin Library to The Clarice",
    draft: true,
    path: [
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
      [-76.94643, 38.98910],
      [-76.94730, 38.98920],
      [-76.94755, 38.98929],
      [-76.94847, 38.98983],
      [-76.94875, 38.99028],
      [-76.94955, 38.99026],
      [-76.94953, 38.99080],
      [-76.94962, 38.99087],
      [-76.94988, 38.99078],
      [-76.95009, 38.99087],
      [-76.95003, 38.99081],
      [-76.95013, 38.99080],
    ],
    cues: [
      { at_path_index: 10, cue: "left", instruction: "Turn left and continue toward The Clarice." },
      { at_path_index: 16, cue: "right", instruction: "Turn right and continue along the campus walkway." },
      { at_path_index: 19, cue: "right", instruction: "Turn right toward The Clarice." },
      { at_path_index: 22, cue: "arrived", instruction: "You have reached The Clarice." },
    ],
  },
  {
    id: "rte_stamp_to_eppley",
    name: "Stamp Student Union to Eppley Recreation Center",
    draft: true,
    path: [
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
      [-76.94520, 38.99039],
      [-76.94506, 38.99041],
      [-76.94504, 38.99044],
      [-76.94502, 38.99126],
      [-76.94496, 38.99153],
      [-76.94499, 38.99153],
      [-76.94501, 38.99209],
      [-76.94478, 38.99220],
      [-76.94449, 38.99246],
      [-76.94445, 38.99266],
      [-76.94437, 38.99276],
      [-76.94474, 38.99300],
      [-76.94506, 38.99302],
      [-76.94506, 38.99341],
    ],
    cues: [
      { at_path_index: 9, cue: "right", instruction: "Turn right and continue along the campus walkway." },
      { at_path_index: 16, cue: "right", instruction: "Turn right toward Eppley Recreation Center." },
      { at_path_index: 20, cue: "left", instruction: "Turn left toward Eppley Recreation Center." },
      { at_path_index: 23, cue: "arrived", instruction: "You have reached Eppley Recreation Center." },
    ],
  },
  {
    id: "rte_eppley_to_xfinity",
    name: "Eppley Recreation Center to XFINITY Center",
    draft: true,
    path: [
      [-76.94506, 38.99341],
      [-76.94507, 38.99310],
      [-76.94471, 38.99311],
      [-76.94416, 38.99306],
      [-76.94254, 38.99307],
      [-76.94246, 38.99302],
      [-76.94220, 38.99309],
      [-76.94178, 38.99326],
      [-76.94158, 38.99321],
      [-76.94112, 38.99346],
      [-76.94084, 38.99349],
      [-76.94081, 38.99459],
      [-76.94037, 38.99459],
      [-76.94036, 38.99470],
      [-76.94024, 38.99483],
      [-76.94012, 38.99524],
      [-76.94009, 38.99616],
      [-76.94019, 38.99623],
      [-76.94040, 38.99624],
      [-76.94056, 38.99637],
      [-76.94074, 38.99631],
      [-76.94070, 38.99585],
    ],
    cues: [
      { at_path_index: 5, cue: "left", instruction: "Turn left and continue toward XFINITY Center." },
      { at_path_index: 11, cue: "right", instruction: "Turn right and continue along the campus walkway." },
      { at_path_index: 16, cue: "left", instruction: "Turn left toward XFINITY Center." },
      { at_path_index: 21, cue: "arrived", instruction: "You have reached XFINITY Center." },
    ],
  },
];
