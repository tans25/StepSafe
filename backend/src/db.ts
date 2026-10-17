import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

export type DB = Database.Database;

export function openDb(file: string): DB {
  if (file !== ":memory:") fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new Database(file);
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS reports (
      id            TEXT PRIMARY KEY,
      category      TEXT NOT NULL,
      lat           REAL NOT NULL,
      lng           REAL NOT NULL,
      note          TEXT,
      created_at    TEXT NOT NULL,
      status        TEXT NOT NULL DEFAULT 'unverified',
      source        TEXT NOT NULL,
      flag_count    INTEGER NOT NULL DEFAULT 0,
      confirm_count INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_reports_created ON reports(created_at);
  `);
  return db;
}
