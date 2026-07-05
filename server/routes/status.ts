import { Router } from "express";
import { getCurrentVideo } from "../services/playlistService.ts";
import { getCurrentPeriod } from "../services/periodService.ts";
import type { PeriodSettings } from "../services/periodService.ts";
import { getSettings } from "./settings.ts";

export const statusRouter = Router();

function resolvePeriod(now: Date, settings: Record<string, boolean | number | string>) {
  return getCurrentPeriod(now, settings as unknown as PeriodSettings);
}

statusRouter.get("/status", (_req, res) => {
  const settings = getSettings();
  const now = new Date();
  const period = resolvePeriod(now, settings);
  const { video } = getCurrentVideo(period, now, Number(settings.refreshIntervalSeconds));

  res.json({
    period,
    currentVideo: video,
    autoMode: settings.autoMode,
    overlayEnabled: settings.overlayEnabled,
    clockEnabled: settings.clockEnabled,
  });
});

statusRouter.get("/current-video", (_req, res) => {
  const settings = getSettings();
  const now = new Date();
  const period = resolvePeriod(now, settings);
  const { video } = getCurrentVideo(period, now, Number(settings.refreshIntervalSeconds));
  res.json({ period, video });
});
