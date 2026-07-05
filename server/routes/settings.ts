import { Router } from "express";
import { db, PERIOD_MODES } from "../db.ts";

export const settingsRouter = Router();

const BOOLEAN_KEYS = new Set(["autoMode", "overlayEnabled", "clockEnabled", "weatherEnabled", "radarEnabled"]);
const NUMBER_KEYS = new Set(["refreshIntervalSeconds", "weatherLatitude", "weatherLongitude"]);
const TIME_KEYS = new Set(["morningStartTime", "daytimeStartTime", "eveningStartTime", "nightStartTime"]);
const STRING_KEYS = new Set(["periodMode", ...TIME_KEYS]);
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

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
    if (TIME_KEYS.has(key) && !TIME_PATTERN.test(String(value))) {
      return res.status(400).json({ error: `'${key}' must be in HH:MM format` });
    }
  }

  const applyUpdate = db.transaction((entries: [string, unknown][]) => {
    for (const [key, value] of entries) {
      upsert.run(key, String(value));
    }
  });
  applyUpdate(Object.entries(updates));

  console.log(`[Settings] Updated: ${Object.keys(updates).join(", ")}`);
  res.json(getSettings());
});
