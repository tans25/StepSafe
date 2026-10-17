import cors from "cors";
import express, { type ErrorRequestHandler } from "express";
import rateLimit from "express-rate-limit";
import { timingSafeEqual } from "node:crypto";
import {
  CATEGORIES, config, DEMO_AREA, DISCLAIMER, HAPTIC_PATTERNS, LIMITS,
} from "./config.js";
import type { DB } from "./db.js";
import { ApiError, errorBody } from "./errors.js";
import {
  confirmReport, createReport, flagReport, getReport, ListQuerySchema, listReports,
  NewReportSchema, parseOrThrow,
} from "./reports.js";
import { getRoute, getRouteWarnings, listRoutes, WarningsQuerySchema } from "./routeService.js";
import { seedDb } from "./seed.js";

export function createApp(db: DB, opts: { rateLimit?: boolean } = {}) {
  const app = express();
  app.use(cors({ origin: config.corsOrigin }));
  app.use(express.json({ limit: "10kb" }));

  const limiter = opts.rateLimit === false
    ? (_q: unknown, _s: unknown, next: () => void) => next()
    : rateLimit({
        windowMs: 60_000,
        limit: 20,
        standardHeaders: true,
        legacyHeaders: false,
        handler: (_req, res) => {
          res.status(429).json(errorBody("rate_limited", "Too many requests."));
        },
      });

  app.get("/api/health", (_req, res) => {
    const users = db.prepare("SELECT COUNT(*) AS n FROM reports WHERE source = 'user'").get() as { n: number };
    res.json({ ok: true, mode: users.n > 0 ? "live" : "seeded", time: new Date().toISOString() });
  });

  app.get("/api/meta", (_req, res) => {
    res.json({ categories: CATEGORIES, demo_area: DEMO_AREA, haptic_patterns: HAPTIC_PATTERNS, limits: LIMITS });
  });

  app.get("/api/reports", (req, res) => {
    const reports = listReports(db, parseOrThrow(ListQuerySchema, req.query));
    res.json({ reports, count: reports.length, disclaimer: DISCLAIMER });
  });

  app.post("/api/reports", limiter, (req, res) => {
    const out = createReport(db, parseOrThrow(NewReportSchema, req.body));
    res.status(201).json(out);
  });

  app.get("/api/reports/:id", (req, res) => {
    res.json({ report: getReport(db, String(req.params.id)) });
  });

  app.post("/api/reports/:id/confirm", limiter, (req, res) => {
    res.json({ report: confirmReport(db, String(req.params.id)) });
  });

  app.post("/api/reports/:id/flag", limiter, (req, res) => {
    res.json({ report: flagReport(db, String(req.params.id)) });
  });

  app.get("/api/routes", (_req, res) => {
    res.json({ routes: listRoutes(db) });
  });

  app.get("/api/routes/:id", (req, res) => {
    res.json(getRoute(db, String(req.params.id)));
  });

  app.get("/api/routes/:id/warnings", (req, res) => {
    const { buffer_m } = parseOrThrow(WarningsQuerySchema, req.query);
    res.json(getRouteWarnings(db, String(req.params.id), buffer_m));
  });

  app.post("/api/admin/reset", (req, res) => {
    const given = Buffer.from(String(req.header("X-Admin-Token") ?? ""));
    const want = Buffer.from(config.adminToken);
    if (!want.length || given.length !== want.length || !timingSafeEqual(given, want))
      throw new ApiError(401, "unauthorized", "Admin token required.");
    res.json({ ok: true, ...seedDb(db) });
  });

  app.use((_req, _res, next) => next(new ApiError(404, "not_found", "No such endpoint.")));

  const onError: ErrorRequestHandler = (err, _req, res, _next) => {
    if (err instanceof ApiError) return void res.status(err.status).json(errorBody(err.code, err.message, err.details));
    if (err?.type === "entity.parse.failed" || err?.type === "entity.too.large")
      return void res.status(400).json(errorBody("validation_failed", "Invalid JSON body."));
    console.error(err);
    res.status(500).json(errorBody("internal_error", "Something went wrong."));
  };
  app.use(onError);
  return app;
}
