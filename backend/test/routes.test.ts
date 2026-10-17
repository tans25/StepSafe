import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { openDb } from "../src/db.js";
import { cumulativeDistancesM, haversineM, projectOntoPath, type LngLat } from "../src/geo.js";
import { buildRoute, validateSeedRoutes } from "../src/routeService.js";
import { seedDb } from "../src/seed.js";
import { SEED_ROUTES, type SeedRoute } from "../src/seedRoutes.js";

// ~111 m north, then ~85 m east, near UMD.
const L: LngLat[] = [
  [-76.945, 38.986],
  [-76.945, 38.987],
  [-76.944, 38.987],
];

describe("geometry", () => {
  it("projects points onto a polyline", () => {
    const cum = cumulativeDistancesM(L);
    const leg1 = haversineM(38.986, -76.945, 38.987, -76.945);
    // 10 m west of the middle of the first leg
    const p = projectOntoPath(L, cum, 38.9865, -76.945 - 0.000115);
    expect(p.offset_m).toBeGreaterThan(9);
    expect(p.offset_m).toBeLessThan(11);
    expect(p.distance_along_m).toBeCloseTo(leg1 / 2, 0);
    // beyond the end clamps to the last vertex
    const end = projectOntoPath(L, cum, 38.987, -76.9);
    expect(end.distance_along_m).toBeCloseTo(cum[2], 0);
  });
});

const good: SeedRoute = {
  id: "rte_test",
  name: "Test",
  draft: false,
  path: L,
  cues: [
    { at_path_index: 1, cue: "right", instruction: "Turn right" },
    { at_path_index: 2, cue: "arrived", instruction: "Done" },
  ],
};

describe("validation", () => {
  it("accepts a good route and builds steps", () => {
    validateSeedRoutes([good]);
    const r = buildRoute(good);
    expect(r.steps.map((s) => s.trigger_radius_m)).toEqual([20, 20]);
    expect(r.steps[1].distance_along_m).toBe(r.distance_m);
  });

  it("rejects swapped coordinates, bad cues and duplicate ids", () => {
    const bad: SeedRoute = {
      ...good,
      path: [[38.986, -76.945], L[1], L[2]],
      cues: [{ at_path_index: 9, cue: "left", instruction: "x" }],
    };
    expect(() => validateSeedRoutes([bad, good, good])).toThrow(/outside the demo area/);
    expect(() => validateSeedRoutes([bad])).toThrow(/not a valid path index/);
    expect(() => validateSeedRoutes([good, good])).toThrow(/duplicate id/);
    expect(() => validateSeedRoutes([{ ...good, cues: [good.cues[0]] }])).toThrow(/last cue must be "arrived"/);
  });

  it("accepts every route in seedRoutes.ts (drafts included)", () => {
    expect(() => validateSeedRoutes(SEED_ROUTES)).not.toThrow();
  });
});

describe("endpoints", () => {
  let app: ReturnType<typeof createApp>;
  beforeEach(() => {
    const db = openDb(":memory:");
    seedDb(db, { includeDraftRoutes: true });
    app = createApp(db, { rateLimit: false });
  });

  it("lists summaries without geometry", async () => {
    const { body } = await request(app).get("/api/routes");
    expect(body.routes).toHaveLength(SEED_ROUTES.length);
    expect(body.routes[0]).not.toHaveProperty("geometry");
    expect(body.routes[0]).toMatchObject({ kind: "prepared" });
  });

  it("returns a full route and 404s unknown ids", async () => {
    const { body, status } = await request(app).get(`/api/routes/${SEED_ROUTES[0].id}`);
    expect(status).toBe(200);
    expect(body.geometry.type).toBe("LineString");
    expect(body.steps.at(-1).cue).toBe("arrived");
    expect(body.disclaimer).toMatch(/UNVERIFIED DRAFT/);
    expect((await request(app).get("/api/routes/nope")).body.error.code).toBe("not_found");
    expect((await request(app).get("/api/routes/nope/warnings")).status).toBe(404);
  });

  it("skips drafts unless asked", async () => {
    const db = openDb(":memory:");
    seedDb(db, { includeDraftRoutes: false });
    const r = await request(createApp(db, { rateLimit: false })).get("/api/routes");
    expect(r.body.routes).toEqual([]);
  });

  it("returns warnings in walking order within the buffer", async () => {
    const { body } = await request(app).get(`/api/routes/${SEED_ROUTES[0].id}/warnings?buffer_m=200`);
    const along = body.warnings.map((w: any) => w.distance_along_m);
    expect(along).toEqual([...along].sort((a, b) => a - b));
    expect(body.warnings.every((w: any) => w.offset_m <= 200 && w.cue === "caution")).toBe(true);
    const narrow = await request(app).get(`/api/routes/${SEED_ROUTES[0].id}/warnings?buffer_m=1`);
    expect(narrow.body.warnings.length).toBeLessThanOrEqual(body.warnings.length);
    expect((await request(app).get(`/api/routes/${SEED_ROUTES[0].id}/warnings?buffer_m=999`)).status).toBe(400);
  });
});
