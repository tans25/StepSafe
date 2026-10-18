import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { openDb } from "../src/db.js";
import { seedDb } from "../src/seed.js";

let app: ReturnType<typeof createApp>;
beforeEach(() => {
  const db = openDb(":memory:");
  seedDb(db);
  app = createApp(db, { rateLimit: false });
});

describe("meta/health", () => {
  it("reports seeded mode and 7 categories", async () => {
    expect((await request(app).get("/api/health")).body.mode).toBe("seeded");
    expect((await request(app).get("/api/meta")).body.categories).toHaveLength(7);
  });
});

describe("reports", () => {
  it("lists seeded reports with staleness flags", async () => {
    const { body } = await request(app).get("/api/reports");
    expect(body.count).toBe(10);
    const old = body.reports.find((r: any) => r.id === "rpt_seed_007");
    expect(old.is_stale).toBe(true);
    expect(body.reports.find((r: any) => r.id === "rpt_seed_006").is_stale).toBe(false);
  });

  it("filters by category and radius", async () => {
    const a = await request(app).get("/api/reports?category=pothole");
    expect(a.body.count).toBe(2);
    const b = await request(app).get("/api/reports?near=38.9881,-76.9437&radius_m=30");
    expect(b.body.reports.map((r: any) => r.id)).toEqual(["rpt_seed_002"]);
    expect((await request(app).get("/api/reports?near=38.98,-76.94")).status).toBe(400);
  });

  it("creates an unverified user report and flips mode to live", async () => {
    const res = await request(app).post("/api/reports").send({ category: "pothole", lat: 38.987, lng: -76.94, note: "x" });
    expect(res.status).toBe(201);
    expect(res.body.report).toMatchObject({ status: "unverified", source: "user" });
    expect((await request(app).get("/api/health")).body.mode).toBe("live");
  });

  it("returns possible duplicates", async () => {
    const body = { category: "other", lat: 38.987, lng: -76.94 };
    await request(app).post("/api/reports").send(body);
    const res = await request(app).post("/api/reports").send(body);
    expect(res.body.possible_duplicate_of).toHaveLength(1);
  });

  it("rejects bad input with stable codes", async () => {
    const bad = await request(app).post("/api/reports").send({ category: "nope", lat: 38.98, lng: -76.94 });
    expect(bad.status).toBe(400);
    expect(bad.body.error.code).toBe("validation_failed");
    const oob = await request(app).post("/api/reports").send({ category: "other", lat: 40, lng: -76.94 });
    expect(oob.body.error.code).toBe("out_of_bounds");
    const extra = await request(app).post("/api/reports").send({ category: "other", lat: 38.98, lng: -76.94, name: "Bob" });
    expect(extra.status).toBe(400);
  });

  it("404s unknown report and hides after 3 flags", async () => {
    expect((await request(app).get("/api/reports/nope")).body.error.code).toBe("not_found");
    for (let i = 0; i < 3; i++) await request(app).post("/api/reports/rpt_seed_001/flag");
    expect((await request(app).get("/api/reports/rpt_seed_001")).body.report.status).toBe("hidden");
    expect((await request(app).get("/api/reports")).body.count).toBe(9);
  });
});

describe("admin", () => {
  it("requires token and resets", async () => {
    expect((await request(app).post("/api/admin/reset")).status).toBe(401);
  });
});

describe("seeding", () => {
  it("keeps user reports when asked, and removes them on a full reset", async () => {
    const db = openDb(":memory:");
    seedDb(db);
    const a = createApp(db, { rateLimit: false });
    await request(a).post("/api/reports").send({ category: "pothole", lat: 38.987, lng: -76.943 });

    seedDb(db, { keepUserReports: true });
    expect((await request(a).get("/api/reports")).body.count).toBe(11);

    seedDb(db);
    expect((await request(a).get("/api/reports")).body.count).toBe(10);
  });
});

describe("rate limit", () => {
  it("counts each forwarded client separately behind the local proxy", async () => {
    const db = openDb(":memory:");
    seedDb(db);
    const limited = createApp(db);
    const post = (ip: string) =>
      request(limited)
        .post("/api/reports/rpt_seed_002/confirm")
        .set("X-Forwarded-For", ip);

    for (let i = 0; i < 20; i++) expect((await post("203.0.113.1")).status).toBe(200);
    expect((await post("203.0.113.1")).status).toBe(429);
    expect((await post("203.0.113.2")).status).toBe(200);
  });
});
