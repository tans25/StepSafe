import { randomUUID } from "node:crypto";
import { z } from "zod";
import { CATEGORY_IDS, DEMO_AREA, LIMITS } from "./config.js";
import type { DB } from "./db.js";
import { ApiError } from "./errors.js";
import { haversineM } from "./geo.js";

interface Row {
  id: string;
  category: string;
  lat: number;
  lng: number;
  note: string | null;
  created_at: string;
  status: string;
  source: string;
  flag_count: number;
  confirm_count: number;
}

export function toReport(r: Row, now = Date.now()) {
  const ageMs = now - Date.parse(r.created_at);
  return {
    ...r,
    is_stale: ageMs > LIMITS.stale_after_days * 86_400_000,
    age_hours: Math.max(0, Math.floor(ageMs / 3_600_000)),
  };
}

export const NewReportSchema = z
  .object({
    category: z.enum(CATEGORY_IDS),
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    note: z.string().trim().max(LIMITS.note_max_length).optional(),
  })
  .strict();

const bool = (def: boolean) =>
  z
    .enum(["true", "false"])
    .optional()
    .transform((v) => (v === undefined ? def : v === "true"));

export const ListQuerySchema = z.object({
  bbox: z
    .string()
    .regex(/^-?\d+(\.\d+)?(,-?\d+(\.\d+)?){3}$/, "must be minLng,minLat,maxLng,maxLat")
    .optional(),
  category: z
    .string()
    .optional()
    .transform((s) => (s ? s.split(",") : undefined))
    .pipe(z.array(z.enum(CATEGORY_IDS)).optional()),
  status: z.enum(["unverified", "confirmed", "resolved", "hidden"]).optional(),
  near: z
    .string()
    .regex(/^-?\d+(\.\d+)?,-?\d+(\.\d+)?$/, "must be lat,lng")
    .optional(),
  radius_m: z.coerce.number().min(1).max(5000).optional(),
  include_stale: bool(true),
  include_hidden: bool(false),
  limit: z.coerce.number().int().min(1).max(500).default(200),
});

export function parseOrThrow<T extends z.ZodTypeAny>(schema: T, data: unknown): z.infer<T> {
  const res = schema.safeParse(data);
  if (res.success) return res.data;
  throw new ApiError(
    400,
    "validation_failed",
    "Invalid request.",
    res.error.issues.map((i) => ({ field: i.path.join(".") || "(root)", issue: i.message })),
  );
}

export function listReports(db: DB, q: z.infer<typeof ListQuerySchema>) {
  if (q.near && q.radius_m === undefined)
    throw new ApiError(400, "validation_failed", "Invalid request.", [
      { field: "radius_m", issue: "required when near is set" },
    ]);

  const where: string[] = [];
  const args: unknown[] = [];
  if (q.status) {
    where.push("status = ?");
    args.push(q.status);
  } else if (!q.include_hidden) where.push("status != 'hidden'");
  if (q.category?.length) {
    where.push(`category IN (${q.category.map(() => "?").join(",")})`);
    args.push(...q.category);
  }
  if (q.bbox) {
    const [minLng, minLat, maxLng, maxLat] = q.bbox.split(",").map(Number);
    where.push("lng BETWEEN ? AND ? AND lat BETWEEN ? AND ?");
    args.push(minLng, maxLng, minLat, maxLat);
  }
  const sql = `SELECT * FROM reports ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY created_at DESC`;
  const now = Date.now();
  let out = (db.prepare(sql).all(...args) as Row[]).map((r) => toReport(r, now));

  if (!q.include_stale) out = out.filter((r) => !r.is_stale);
  if (q.near) {
    const [lat, lng] = q.near.split(",").map(Number);
    out = out.filter((r) => haversineM(lat, lng, r.lat, r.lng) <= q.radius_m!);
  }
  return out.slice(0, q.limit);
}

export function getReport(db: DB, id: string) {
  const row = db.prepare("SELECT * FROM reports WHERE id = ?").get(id) as Row | undefined;
  if (!row) throw new ApiError(404, "not_found", "Report not found.");
  return toReport(row);
}

export function createReport(db: DB, input: z.infer<typeof NewReportSchema>) {
  const b = DEMO_AREA.bounds;
  if (input.lat < b.min_lat || input.lat > b.max_lat || input.lng < b.min_lng || input.lng > b.max_lng)
    throw new ApiError(400, "out_of_bounds", "Location is outside the demo area.");

  const id = `rpt_${randomUUID().slice(0, 8)}`;
  const nowIso = new Date().toISOString();
  db.prepare(
    `INSERT INTO reports (id, category, lat, lng, note, created_at, status, source)
     VALUES (?, ?, ?, ?, ?, ?, 'unverified', 'user')`,
  ).run(id, input.category, input.lat, input.lng, input.note || null, nowIso);

  const since = new Date(Date.now() - 86_400_000).toISOString();
  const dupes = (
    db
      .prepare("SELECT * FROM reports WHERE category = ? AND id != ? AND created_at >= ? AND status != 'hidden'")
      .all(input.category, id, since) as Row[]
  )
    .filter((r) => haversineM(input.lat, input.lng, r.lat, r.lng) <= 15)
    .map((r) => r.id);

  return { report: getReport(db, id), possible_duplicate_of: dupes };
}

export function confirmReport(db: DB, id: string) {
  getReport(db, id);
  db.prepare("UPDATE reports SET confirm_count = confirm_count + 1 WHERE id = ?").run(id);
  return getReport(db, id);
}

export function flagReport(db: DB, id: string) {
  getReport(db, id);
  db.prepare(
    `UPDATE reports SET flag_count = flag_count + 1,
       status = CASE WHEN flag_count + 1 >= 3 THEN 'hidden' ELSE status END WHERE id = ?`,
  ).run(id);
  return getReport(db, id);
}
