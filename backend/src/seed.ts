import { fileURLToPath } from "node:url";
import { config } from "./config.js";
import { openDb, type DB } from "./db.js";
import { loadRoutes } from "./routeService.js";
import { SEED_REPORTS } from "./seedData.js";
import { SEED_ROUTES } from "./seedRoutes.js";

export function seedDb(db: DB, opts: { includeDraftRoutes?: boolean } = {}) {
  const now = Date.now();
  const insert = db.prepare(
    `INSERT INTO reports (id, category, lat, lng, note, created_at, status, source)
     VALUES (?, ?, ?, ?, ?, ?, 'unverified', 'seed')`,
  );
  db.transaction(() => {
    db.exec("DELETE FROM reports");
    for (const r of SEED_REPORTS)
      insert.run(r.id, r.category, r.lat, r.lng, r.note, new Date(now - r.ageHours * 3_600_000).toISOString());
  })();
  return { reports_seeded: SEED_REPORTS.length, routes_seeded: loadRoutes(db, SEED_ROUTES, opts.includeDraftRoutes ?? config.includeDraftRoutes) };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const res = seedDb(openDb(config.dbPath));
  console.log("Seeded:", res);
}
