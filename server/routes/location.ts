import { Router } from "express";
import { db } from "../db.ts";
import { detectLocation } from "../services/locationService.ts";

export const locationRouter = Router();

const upsertSetting = db.prepare(
  "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
);

locationRouter.post("/detect", async (_req, res) => {
  const location = await detectLocation();
  if (!location) {
    return res.status(502).json({ error: "Failed to detect location from IP address" });
  }

  const applyUpdate = db.transaction(() => {
    upsertSetting.run("weatherLatitude", String(location.latitude));
    upsertSetting.run("weatherLongitude", String(location.longitude));
    upsertSetting.run("locationSource", "auto");
  });
  applyUpdate();

  console.log(
    `[Location] Detected location from IP: ${location.city ?? "unknown city"} (${location.latitude}, ${location.longitude})`
  );
  res.json({
    latitude: location.latitude,
    longitude: location.longitude,
    city: location.city,
  });
});
