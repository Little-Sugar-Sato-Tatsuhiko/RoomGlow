import { Router } from "express";
import { getRadar } from "../services/radarService.ts";
import { getSettings } from "./settings.ts";

export const radarRouter = Router();

radarRouter.get("/", async (_req, res) => {
  const settings = getSettings();
  if (!settings.radarEnabled) {
    return res.json({ enabled: false });
  }

  try {
    const radar = await getRadar(Number(settings.weatherLatitude), Number(settings.weatherLongitude));
    res.json({ enabled: true, ...radar });
  } catch (error) {
    console.error("[Radar] Failed to fetch radar data:", error);
    res.status(502).json({ error: "Failed to fetch radar data" });
  }
});
