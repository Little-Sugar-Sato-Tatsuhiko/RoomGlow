import { useEffect, useState } from "react";
import ClockWidget from "./ClockWidget.tsx";
import WeatherWidget from "./WeatherWidget.tsx";
import CalendarWidget from "./CalendarWidget.tsx";
import RainRadar from "./RainRadar.tsx";
import { PERIOD_LABELS } from "../types.ts";
import type { Period, RadarData, WeatherData } from "../types.ts";

interface Props {
  clockEnabled: boolean;
  period: Period | null;
  noVideo: boolean;
  weather?: WeatherData;
  radar?: RadarData;
}

// Small periodic position shift to reduce OLED/panel burn-in over long uptimes.
const SHIFT_STEPS_PX = [0, 12, 24, 36];
const SHIFT_INTERVAL_MS = 10 * 60 * 1000;

export default function OverlayLayer({ clockEnabled, period, noVideo, weather, radar }: Props) {
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
      <div className="overlay-panel">
        {clockEnabled && <ClockWidget />}
        {period && <p className="overlay-period">{PERIOD_LABELS[period]}の時間帯</p>}
        {noVideo && <p className="overlay-no-video">No video available</p>}
        <WeatherWidget data={weather} />
        <RainRadar data={radar} />
        <CalendarWidget />
      </div>
    </div>
  );
}
