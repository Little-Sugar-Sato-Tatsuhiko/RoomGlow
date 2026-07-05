import { Router } from "express";
import { getWeather } from "../services/weatherService.ts";
import { getSettings } from "./settings.ts";

export const weatherRouter = Router();

weatherRouter.get("/", async (_req, res) => {
  const settings = getSettings();
  if (!settings.weatherEnabled) {
    return res.json({ enabled: false });
  }

  try {
    const weather = await getWeather(
      Number(settings.weatherLatitude),
      Number(settings.weatherLongitude)
    );
    res.json({ enabled: true, ...weather });
  } catch (error) {
    console.error("[Weather] Failed to fetch weather data:", error);
    res.status(502).json({ error: "Failed to fetch weather data" });
  }
});
