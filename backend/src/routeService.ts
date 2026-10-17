import { z } from "zod";
import { DEMO_AREA } from "./config.js";
import type { DB } from "./db.js";
import { ApiError } from "./errors.js";
import { cumulativeDistancesM, projectOntoPath } from "./geo.js";
import { toReport } from "./reports.js";
import type { SeedRoute } from "./seedRoutes.js";

const WALKING_SPEED_MPS = 1.3;
const DEFAULT_TRIGGER_RADIUS_M = 20;
const ROUTE_DISCLAIMER =
  "Prepared demo route, not live guidance. It may not reflect closures, curb ramps or surface conditions. Rely on your own judgment.";
const DRAFT_DISCLAIMER = "UNVERIFIED DRAFT: this route has not been checked on foot. " + ROUTE_DISCLAIMER;

export interface RouteStep {
  index: number;
  cue: "left" | "right" | "caution" | "arrived";
  location: { lat: number; lng: number };
  trigger_radius_m: number;
  distance_along_m: number;
  instruction: string;
}

export interface Route {
  id: string;
  name: string;
  distance_m: number;
  est_minutes: number;
  kind: "prepared";
  disclaimer: string;
  geometry: { type: "LineString"; coordinates: [number, number][] };
  steps: RouteStep[];
}

/** Throws one Error listing every problem found, so a bad seed fails loudly at load time. */
export function validateSeedRoutes(routes: SeedRoute[]): void {
  const problems: string[] = [];
  const b = DEMO_AREA.bounds;
  const ids = new Set<string>();

  for (const r of routes) {
    const at = `route "${r.id}"`;
    if (!/^rte_[a-z0-9_]+$/.test(r.id)) problems.push(`${at}: id must match rte_[a-z0-9_]+`);
    if (ids.has(r.id)) problems.push(`${at}: duplicate id`);
    ids.add(r.id);
    if (!r.name?.trim()) problems.push(`${at}: name is empty`);
    if (r.path.length < 2) problems.push(`${at}: path needs at least 2 points`);

    r.path.forEach(([lng, lat], i) => {
      if (lat < b.min_lat || lat > b.max_lat || lng < b.min_lng || lng > b.max_lng)
        problems.push(
          `${at}: path[${i}] = [${lng}, ${lat}] is outside the demo area (check [lng, lat] order, not [lat, lng])`,
        );
    });

    if (!r.cues.length) problems.push(`${at}: needs at least one cue`);
    let prev = -1;
    r.cues.forEach((c, k) => {
      if (!Number.isInteger(c.at_path_index) || c.at_path_index < 0 || c.at_path_index >= r.path.length)
        problems.push(`${at}: cues[${k}].at_path_index ${c.at_path_index} is not a valid path index (0..${r.path.length - 1})`);
      else if (c.at_path_index <= prev) problems.push(`${at}: cues[${k}] is not in increasing path order`);
      else prev = c.at_path_index;
      if (!c.instruction?.trim()) problems.push(`${at}: cues[${k}] has no instruction`);
    });
    const last = r.cues[r.cues.length - 1];
    if (last && (last.cue !== "arrived" || last.at_path_index !== r.path.length - 1))
      problems.push(`${at}: last cue must be "arrived" at the final path index (${r.path.length - 1})`);
  }

  if (problems.length) throw new Error("Invalid seed routes:\n - " + problems.join("\n - "));
}

export function buildRoute(seed: SeedRoute): Route {
  const cum = cumulativeDistancesM(seed.path);
  const total = cum[cum.length - 1];
  return {
    id: seed.id,
    name: seed.name,
    distance_m: Math.round(total),
    est_minutes: Math.max(1, Math.round(total / WALKING_SPEED_MPS / 60)),
    kind: "prepared",
    disclaimer: seed.draft ? DRAFT_DISCLAIMER : ROUTE_DISCLAIMER,
    geometry: { type: "LineString", coordinates: seed.path },
    steps: seed.cues.map((c, index) => ({
      index,
      cue: c.cue,
      location: { lat: seed.path[c.at_path_index][1], lng: seed.path[c.at_path_index][0] },
      trigger_radius_m: c.trigger_radius_m ?? DEFAULT_TRIGGER_RADIUS_M,
      distance_along_m: Math.round(cum[c.at_path_index]),
      instruction: c.instruction,
    })),
  };
}

/** Replaces all stored routes. Draft routes are skipped unless includeDrafts is set. */
export function loadRoutes(db: DB, seeds: SeedRoute[], includeDrafts: boolean): number {
  validateSeedRoutes(seeds);
  const chosen = seeds.filter((r) => includeDrafts || !r.draft);
  const insert = db.prepare("INSERT INTO routes (id, position, data) VALUES (?, ?, ?)");
  db.transaction(() => {
    db.exec("DELETE FROM routes");
    chosen.forEach((r, i) => insert.run(r.id, i, JSON.stringify(buildRoute(r))));
  })();
  return chosen.length;
}

export function countRoutes(db: DB): number {
  return (db.prepare("SELECT COUNT(*) AS n FROM routes").get() as { n: number }).n;
}

export function listRoutes(db: DB) {
  const rows = db.prepare("SELECT data FROM routes ORDER BY position").all() as { data: string }[];
  return rows.map((r) => {
    const { geometry: _g, steps: _s, ...summary } = JSON.parse(r.data) as Route;
    return summary;
  });
}

export function getRoute(db: DB, id: string): Route {
  const row = db.prepare("SELECT data FROM routes WHERE id = ?").get(id) as { data: string } | undefined;
  if (!row) throw new ApiError(404, "not_found", "Route not found.");
  return JSON.parse(row.data) as Route;
}

export const WarningsQuerySchema = z.object({
  buffer_m: z.coerce.number().min(1).max(200).default(25),
});

export function getRouteWarnings(db: DB, id: string, bufferM: number) {
  const route = getRoute(db, id);
  const path = route.geometry.coordinates;
  const cum = cumulativeDistancesM(path);
  const now = Date.now();
  const rows = db.prepare("SELECT * FROM reports WHERE status != 'hidden'").all() as Parameters<typeof toReport>[0][];

  const warnings = rows
    .map((row) => ({ report: toReport(row, now), ...projectOntoPath(path, cum, row.lat, row.lng) }))
    .filter((w) => w.offset_m <= bufferM)
    .sort((a, b) => a.distance_along_m - b.distance_along_m)
    .map((w) => ({
      report: w.report,
      distance_along_m: Math.round(w.distance_along_m),
      offset_m: Math.round(w.offset_m),
      cue: "caution" as const,
    }));

  return { route_id: id, buffer_m: bufferM, warnings };
}
