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
   * Leave `true` while the coordinates are placeholders. The loader skips
   * routes with draft: true, so fake data never reaches the API.
   * Change to `false` (or delete the line) once you have traced the real path.
   */
  draft: boolean;
  /** Ordered walking line, [lng, lat] pairs, start to finish. At least 2 points. */
  path: [number, number][];
  /** Cue points along the path, in walking order. Don't create cues for hazards here; those come from reports automatically. */
  cues: SeedCue[];
}

export const SEED_ROUTES: SeedRoute[] = [
  {
    // REPLACE: keep the "rte_" prefix, e.g. "rte_mckeldin_to_stamp".
    id: "rte_placeholder_1",
    // REPLACE: describe the real start and end.
    name: "PLACEHOLDER: start to end",
    // CHANGE to false once path and cues below are real.
    draft: true,
    path: [
      // REPLACE ALL of these with your traced points. [lng, lat]. Example values only:
      [-76.9450, 38.9860], // 0: start
      [-76.9445, 38.9866], // 1: replace
      [-76.9438, 38.9866], // 2: a corner, so it gets a turn cue below
      [-76.9438, 38.9875], // 3: replace
      [-76.9430, 38.9878], // 4: end
    ],
    cues: [
      // One cue per turn. at_path_index points at the corner vertex in `path` above.
      { at_path_index: 2, cue: "left", instruction: "REPLACE: Turn left onto ..." },
      // Add "caution" cues for places you want a warning even without a report,
      // e.g. a crossing or a steep ramp. Optional.
      { at_path_index: 3, cue: "caution", instruction: "REPLACE: Crosswalk ahead, look and listen" },
      // The last cue must be "arrived" at the final path index.
      { at_path_index: 4, cue: "arrived", instruction: "REPLACE: You have arrived at ..." },
    ],
  },

  // SECOND ROUTE (optional): copy the block above, give it a new unique id,
  // and fill it in the same way.
];
