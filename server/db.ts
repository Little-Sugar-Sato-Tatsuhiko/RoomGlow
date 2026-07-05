import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

export const ROOT_DIR = process.env.APP_ROOT_DIR || process.cwd();
export const VIDEOS_DIR = process.env.APP_VIDEOS_DIR || path.join(ROOT_DIR, "videos");
export const DATA_DIR = process.env.APP_DATA_DIR || path.join(ROOT_DIR, "data");
export const DB_PATH = path.join(DATA_DIR, "ai-window.sqlite");

export const PERIODS = ["morning", "daytime", "evening", "night"] as const;
export type Period = (typeof PERIODS)[number];

export const VIDEO_SOURCES = ["local", "youtube"] as const;
export type VideoSource = (typeof VIDEO_SOURCES)[number];

export const PERIOD_MODES = ["auto", "manual"] as const;
export type PeriodMode = (typeof PERIOD_MODES)[number];

export const DEFAULT_SETTINGS = {
  autoMode: "true",
  overlayEnabled: "true",
  clockEnabled: "true",
  refreshIntervalSeconds: "60",
  weatherEnabled: "true",
  weatherLatitude: "35.6762",
  weatherLongitude: "139.6503",
  radarEnabled: "true",
  periodMode: "auto",
  morningStartTime: "05:00",
  daytimeStartTime: "11:00",
  eveningStartTime: "17:00",
  nightStartTime: "21:00",
};

function ensureDirectories() {
  for (const dir of [DATA_DIR, ...PERIODS.map((p) => path.join(VIDEOS_DIR, p))]) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`[DB] Created missing directory: ${dir}`);
    }
  }
}

ensureDirectories();

const dbExisted = fs.existsSync(DB_PATH);
export const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS videos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    relative_path TEXT NOT NULL UNIQUE,
    period TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT 'local',
    youtube_id TEXT,
    enabled INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
`);

const videoColumns = new Set(
  (db.prepare("PRAGMA table_info(videos)").all() as { name: string }[]).map((c) => c.name)
);
if (!videoColumns.has("source")) {
  db.exec("ALTER TABLE videos ADD COLUMN source TEXT NOT NULL DEFAULT 'local'");
  console.log("[DB] Migrated videos table: added 'source' column");
}
if (!videoColumns.has("youtube_id")) {
  db.exec("ALTER TABLE videos ADD COLUMN youtube_id TEXT");
  console.log("[DB] Migrated videos table: added 'youtube_id' column");
}

db.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`);

const insertDefaultSetting = db.prepare(
  "INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)"
);
for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
  insertDefaultSetting.run(key, value);
}

console.log(
  `[DB] ${dbExisted ? "Opened existing" : "Initialized new"} SQLite database at ${DB_PATH}`
);
