import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import BackgroundVideo from "../components/BackgroundVideo.tsx";
import OverlayLayer from "../components/OverlayLayer.tsx";
import type {
  AdvanceResponse,
  Period,
  RadarData,
  RadarResponse,
  Settings,
  StatusResponse,
  Video,
  WeatherData,
  WeatherResponse,
} from "../types.ts";

const DEFAULT_SETTINGS: Settings = {
  autoMode: true,
  overlayEnabled: true,
  clockEnabled: true,
  refreshIntervalSeconds: 60,
  weatherEnabled: true,
  weatherLatitude: 35.6762,
  weatherLongitude: 139.6503,
  radarEnabled: true,
  periodMode: "auto",
  morningStartTime: "05:00",
  daytimeStartTime: "11:00",
  eveningStartTime: "17:00",
  nightStartTime: "21:00",
};

const CURSOR_IDLE_TIMEOUT_MS = 3000;
const WEATHER_REFRESH_INTERVAL_MS = 10 * 60 * 1000;
const RADAR_REFRESH_INTERVAL_MS = 5 * 60 * 1000;

export default function DisplayPage() {
  const [period, setPeriod] = useState<Period | null>(null);
  const [displayedVideo, setDisplayedVideo] = useState<Video | null>(null);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [cursorVisible, setCursorVisible] = useState(true);
  const [weather, setWeather] = useState<WeatherData | undefined>(undefined);
  const [radar, setRadar] = useState<RadarData | undefined>(undefined);
  const [hasMultipleVideos, setHasMultipleVideos] = useState(false);
  const timeoutRef = useRef<number>();
  const intervalSecondsRef = useRef(DEFAULT_SETTINGS.refreshIntervalSeconds);
  const cursorIdleTimeoutRef = useRef<number>();

  useEffect(() => {
    let cancelled = false;

    async function tick() {
      try {
        const [statusRes, settingsRes] = await Promise.all([
          fetch("/api/status"),
          fetch("/api/settings"),
        ]);
        const statusData: StatusResponse = await statusRes.json();
        const settingsData: Settings = await settingsRes.json();
        if (cancelled) return;

        intervalSecondsRef.current = settingsData.refreshIntervalSeconds || 60;
        setSettings(settingsData);
        setPeriod(statusData.period);
        setHasMultipleVideos(statusData.hasMultipleVideos);
        setDisplayedVideo((prev) =>
          settingsData.autoMode ? statusData.currentVideo : prev ?? statusData.currentVideo
        );
      } catch (error) {
        console.error("[Display] Failed to fetch status", error);
      } finally {
        if (!cancelled) {
          timeoutRef.current = window.setTimeout(tick, intervalSecondsRef.current * 1000);
        }
      }
    }

    tick();
    return () => {
      cancelled = true;
      window.clearTimeout(timeoutRef.current);
    };
  }, []);

  useEffect(() => {
    function resetIdleTimer() {
      setCursorVisible(true);
      window.clearTimeout(cursorIdleTimeoutRef.current);
      cursorIdleTimeoutRef.current = window.setTimeout(() => {
        setCursorVisible(false);
      }, CURSOR_IDLE_TIMEOUT_MS);
    }

    resetIdleTimer();
    window.addEventListener("mousemove", resetIdleTimer);
    return () => {
      window.removeEventListener("mousemove", resetIdleTimer);
      window.clearTimeout(cursorIdleTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function fetchWeather() {
      try {
        const res = await fetch("/api/weather");
        const data: WeatherResponse = await res.json();
        if (cancelled) return;
        setWeather(data.enabled ? data : undefined);
      } catch (error) {
        console.error("[Display] Failed to fetch weather", error);
      }
    }

    fetchWeather();
    const id = window.setInterval(fetchWeather, WEATHER_REFRESH_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function fetchRadar() {
      try {
        const res = await fetch("/api/radar");
        const data: RadarResponse = await res.json();
        if (cancelled) return;
        setRadar(data.enabled ? data : undefined);
      } catch (error) {
        console.error("[Display] Failed to fetch radar", error);
      }
    }

    fetchRadar();
    const id = window.setInterval(fetchRadar, RADAR_REFRESH_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  async function handleVideoEnded() {
    try {
      const res = await fetch("/api/videos/advance", { method: "POST" });
      const data: AdvanceResponse = await res.json();
      setHasMultipleVideos(data.hasMultipleVideos);
      setDisplayedVideo(data.video);
    } catch (error) {
      console.error("[Display] Failed to advance video", error);
    }
  }

  return (
    <div className={`display-page ${cursorVisible ? "" : "cursor-hidden"}`}>
      <BackgroundVideo video={displayedVideo} loop={!hasMultipleVideos} onEnded={handleVideoEnded} />
      {settings.overlayEnabled && (
        <OverlayLayer
          clockEnabled={settings.clockEnabled}
          period={period}
          noVideo={displayedVideo === null}
          weather={weather}
          radar={radar}
        />
      )}
      <Link className="admin-link" to="/admin">
        管理画面へ
      </Link>
    </div>
  );
}
