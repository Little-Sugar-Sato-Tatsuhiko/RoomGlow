import { useEffect, useState } from "react";

interface Props {
  sunrise?: string | null;
  sunset?: string | null;
}

// Arc geometry (SVG user units). The dome runs from the sunrise point to the
// sunset point, peaking above the midpoint like an elliptical sun path.
const CX = 150;
const CY = 78;
const RX = 130;
const RY = 66;
const START = { x: CX - RX, y: CY };
const END = { x: CX + RX, y: CY };

function parseTimeToday(time: string, reference: Date): Date | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(time);
  if (!match) return null;
  const result = new Date(reference);
  result.setHours(Number(match[1]), Number(match[2]), 0, 0);
  return result;
}

function sunPoint(t: number): { x: number; y: number } {
  const theta = Math.PI * (1 - t);
  return {
    x: CX + RX * Math.cos(theta),
    y: CY - RY * Math.sin(theta),
  };
}

export default function SunTimes({ sunrise, sunset }: Props) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30 * 1000);
    return () => window.clearInterval(id);
  }, []);

  if (!sunrise || !sunset) return null;

  const sunriseDate = parseTimeToday(sunrise, now);
  const sunsetDate = parseTimeToday(sunset, now);
  if (!sunriseDate || !sunsetDate || sunsetDate <= sunriseDate) return null;

  const rawT = (now.getTime() - sunriseDate.getTime()) / (sunsetDate.getTime() - sunriseDate.getTime());
  const isDaytime = rawT >= 0 && rawT <= 1;
  const t = Math.min(1, Math.max(0, rawT));
  const sun = sunPoint(t);

  return (
    <div className={`sun-path${isDaytime ? "" : " sun-path--night"}`}>
      <svg className="sun-path__svg" viewBox="0 0 300 100" preserveAspectRatio="xMidYMid meet">
        <path
          className="sun-path__arc"
          d={`M ${START.x} ${START.y} A ${RX} ${RY} 0 0 1 ${END.x} ${END.y}`}
          fill="none"
        />
        <line className="sun-path__horizon" x1={START.x} y1={START.y} x2={END.x} y2={END.y} />
        {isDaytime && (
          <circle className="sun-path__sun" cx={sun.x} cy={sun.y} r={7} />
        )}
      </svg>
      <div className="sun-path__labels">
        <span className="sun-path__label">🌅 {sunrise}</span>
        <span className="sun-path__label">🌇 {sunset}</span>
      </div>
    </div>
  );
}
