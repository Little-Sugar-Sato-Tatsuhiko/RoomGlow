import { getTimes } from "suncalc";
import { PERIODS } from "../db.ts";
import type { Period } from "../db.ts";

export interface PeriodSettings {
  periodMode: string;
  weatherLatitude: number;
  weatherLongitude: number;
  morningStartTime: string;
  daytimeStartTime: string;
  eveningStartTime: string;
  nightStartTime: string;
}

const DEFAULT_BOUNDARIES: Record<Period, number> = {
  morning: 5 * 60,
  daytime: 11 * 60,
  evening: 17 * 60,
  night: 21 * 60,
};

// How far the morning/evening windows extend from sunrise/sunset in "auto" mode.
const MORNING_DURATION_MINUTES = 3 * 60;
const EVENING_LEAD_MINUTES = 2 * 60;
const EVENING_TAIL_MINUTES = 60;

function toMinutesOfDay(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

function parseTimeToMinutes(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

function resolvePeriod(nowMinutes: number, boundaries: Record<Period, number>): Period {
  const sorted = PERIODS.map((period) => ({ period, startMinutes: boundaries[period] })).sort(
    (a, b) => a.startMinutes - b.startMinutes
  );

  let result: Period = sorted[sorted.length - 1].period;
  for (const boundary of sorted) {
    if (boundary.startMinutes <= nowMinutes) result = boundary.period;
  }
  return result;
}

function getValidSunTimes(date: Date, latitude: number, longitude: number): { sunrise: Date; sunset: Date } | null {
  const { sunrise, sunset } = getTimes(date, latitude, longitude);
  if (!sunrise || !sunset || Number.isNaN(sunrise.getTime()) || Number.isNaN(sunset.getTime())) {
    return null;
  }
  return { sunrise, sunset };
}

function computeAutoBoundaries(date: Date, latitude: number, longitude: number): Record<Period, number> {
  const sunTimes = getValidSunTimes(date, latitude, longitude);
  if (!sunTimes) return DEFAULT_BOUNDARIES;

  return {
    morning: toMinutesOfDay(sunTimes.sunrise),
    daytime: toMinutesOfDay(sunTimes.sunrise) + MORNING_DURATION_MINUTES,
    evening: toMinutesOfDay(sunTimes.sunset) - EVENING_LEAD_MINUTES,
    night: toMinutesOfDay(sunTimes.sunset) + EVENING_TAIL_MINUTES,
  };
}

function formatTime(date: Date): string {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

export function getSunTimes(
  date: Date,
  latitude: number,
  longitude: number
): { sunrise: string; sunset: string } | null {
  const sunTimes = getValidSunTimes(date, latitude, longitude);
  if (!sunTimes) return null;
  return { sunrise: formatTime(sunTimes.sunrise), sunset: formatTime(sunTimes.sunset) };
}

function computeManualBoundaries(settings: PeriodSettings): Record<Period, number> {
  const morning = parseTimeToMinutes(settings.morningStartTime);
  const daytime = parseTimeToMinutes(settings.daytimeStartTime);
  const evening = parseTimeToMinutes(settings.eveningStartTime);
  const night = parseTimeToMinutes(settings.nightStartTime);

  if (morning === null || daytime === null || evening === null || night === null) {
    return DEFAULT_BOUNDARIES;
  }

  return { morning, daytime, evening, night };
}

export function getCurrentPeriod(date: Date, settings: PeriodSettings): Period {
  const boundaries =
    settings.periodMode === "manual"
      ? computeManualBoundaries(settings)
      : computeAutoBoundaries(date, settings.weatherLatitude, settings.weatherLongitude);

  return resolvePeriod(toMinutesOfDay(date), boundaries);
}
