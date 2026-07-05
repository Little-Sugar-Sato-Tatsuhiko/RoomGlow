import { Router } from "express";
import { db, LOCATION_SOURCES, PERIOD_MODES } from "../db.ts";

export const settingsRouter = Router();

const BOOLEAN_KEYS = new Set(["autoMode", "overlayEnabled", "clockEnabled", "weatherEnabled", "radarEnabled"]);
const NUMBER_KEYS = new Set(["refreshIntervalSeconds", "weatherLatitude", "weatherLongitude"]);
const TIME_KEYS = new Set(["morningStartTime", "daytimeStartTime", "eveningStartTime", "nightStartTime"]);
const STRING_KEYS = new Set(["periodMode", "locationSource", ...TIME_KEYS]);
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const LOCATION_KEYS = new Set(["weatherLatitude", "weatherLongitude"]);

const selectAll = db.prepare("SELECT key, value FROM settings");
const upsert = db.prepare(
  "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
);

function parseValue(key: string, value: string): boolean | number | string {
  if (BOOLEAN_KEYS.has(key)) return value === "true";
  if (NUMBER_KEYS.has(key)) return Number(value);
  return value;
}

export function getSettings(): Record<string, boolean | number | string> {
  const rows = selectAll.all() as { key: string; value: string }[];
  const settings: Record<string, boolean | number | string> = {};
  for (const row of rows) {
    settings[row.key] = parseValue(row.key, row.value);
  }
  return settings;
}

settingsRouter.get("/", (_req, res) => {
  res.json(getSettings());
});

settingsRouter.patch("/", (req, res) => {
  const updates = req.body ?? {};
  const validKeys = [...BOOLEAN_KEYS, ...NUMBER_KEYS, ...STRING_KEYS];

  for (const [key, value] of Object.entries(updates)) {
    if (!validKeys.includes(key)) {
      return res.status(400).json({ error: `Unknown setting: ${key}` });
    }
    if (key === "periodMode" && !PERIOD_MODES.includes(value as (typeof PERIOD_MODES)[number])) {
      return res.status(400).json({ error: `'periodMode' must be one of: ${PERIOD_MODES.join(", ")}` });
    }
    if (key === "locationSource" && !LOCATION_SOURCES.includes(value as (typeof LOCATION_SOURCES)[number])) {
      return res.status(400).json({ error: `'locationSource' must be one of: ${LOCATION_SOURCES.join(", ")}` });
    }
    if (TIME_KEYS.has(key) && !TIME_PATTERN.test(String(value))) {
      return res.status(400).json({ error: `'${key}' must be in HH:MM format` });
    }
  }

  // Editing the coordinates by hand means the auto-detected location should no
  // longer be silently overwritten on the next startup, unless this same
  // request already says otherwise.
  const entries = Object.entries(updates);
  const editsLocationDirectly = entries.some(([key]) => LOCATION_KEYS.has(key));
  if (editsLocationDirectly && !("locationSource" in updates)) {
    entries.push(["locationSource", "manual"]);
  }

  const applyUpdate = db.transaction((items: [string, unknown][]) => {
    for (const [key, value] of items) {
      upsert.run(key, String(value));
    }
  });
  applyUpdate(entries);

  console.log(`[Settings] Updated: ${Object.keys(updates).join(", ")}`);
  res.json(getSettings());
});
