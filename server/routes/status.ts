import { Router } from "express";
import { getCurrentVideo } from "../services/playlistService.ts";
import { getCurrentPeriod, getSunTimes } from "../services/periodService.ts";
import type { PeriodSettings } from "../services/periodService.ts";
import { getSettings } from "./settings.ts";

export const statusRouter = Router();

function resolvePeriod(now: Date, settings: Record<string, boolean | number | string>) {
  return getCurrentPeriod(now, settings as unknown as PeriodSettings);
}

statusRouter.get("/status", (_req, res) => {
  const settings = getSettings();
  const period = resolvePeriod(new Date(), settings);
  const { video, hasMultipleVideos } = getCurrentVideo(period);
  const sunTimes = getSunTimes(new Date(), Number(settings.weatherLatitude), Number(settings.weatherLongitude));

  res.json({
    period,
    currentVideo: video,
    hasMultipleVideos,
    autoMode: settings.autoMode,
    overlayEnabled: settings.overlayEnabled,
    clockEnabled: settings.clockEnabled,
    sunrise: sunTimes?.sunrise ?? null,
    sunset: sunTimes?.sunset ?? null,
  });
});

statusRouter.get("/current-video", (_req, res) => {
  const settings = getSettings();
  const period = resolvePeriod(new Date(), settings);
  const { video, hasMultipleVideos } = getCurrentVideo(period);
  res.json({ period, video, hasMultipleVideos });
});

export { resolvePeriod };
