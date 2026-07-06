import { useEffect, useState } from "react";
import ClockWidget from "./ClockWidget.tsx";
import WeatherWidget from "./WeatherWidget.tsx";
import CalendarWidget from "./CalendarWidget.tsx";
import MonthCalendar from "./MonthCalendar.tsx";
import RainRadar from "./RainRadar.tsx";
import SunTimes from "./SunTimes.tsx";
import type { RadarData, WeatherData } from "../types.ts";

interface Props {
  clockEnabled: boolean;
  noVideo: boolean;
  weather?: WeatherData;
  radar?: RadarData;
  sunrise?: string | null;
  sunset?: string | null;
}

// Small periodic position shift to reduce OLED/panel burn-in over long uptimes.
const SHIFT_STEPS_PX = [0, 12, 24, 36];
const SHIFT_INTERVAL_MS = 10 * 60 * 1000;

export default function OverlayLayer({ clockEnabled, noVideo, weather, radar, sunrise, sunset }: Props) {
  const [shift, setShift] = useState(0);

  useEffect(() => {
    function updateShift() {
      const step = Math.floor(Date.now() / SHIFT_INTERVAL_MS) % SHIFT_STEPS_PX.length;
      setShift(SHIFT_STEPS_PX[step]);
    }
    updateShift();
    const id = window.setInterval(updateShift, 60 * 1000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="overlay-layer" style={{ transform: `translate(-${shift}px, -${shift}px)` }}>
      <div className="rain-radar-corner">
        <RainRadar data={radar} />
      </div>
      <div className="month-calendar-corner">
        <MonthCalendar />
      </div>
      <div className="overlay-panel">
        {clockEnabled && <ClockWidget />}
        {noVideo && <p className="overlay-no-video">No video available</p>}
        <WeatherWidget data={weather} />
        <SunTimes sunrise={sunrise} sunset={sunset} />
        <CalendarWidget />
      </div>
    </div>
  );
}
