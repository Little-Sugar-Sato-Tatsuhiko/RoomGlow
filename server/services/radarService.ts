const CACHE_TTL_MS = 5 * 60 * 1000;
const ZOOM = 7;

export interface RadarData {
  zoom: number;
  centerTileX: number;
  centerTileY: number;
  radarPath: string;
  generatedAt: number;
}

interface RainViewerResponse {
  generated: number;
  radar: {
    past: { time: number; path: string }[];
    nowcast: { time: number; path: string }[];
  };
}

function lonToTileX(lon: number, zoom: number): number {
  return Math.floor(((lon + 180) / 360) * 2 ** zoom);
}

function latToTileY(lat: number, zoom: number): number {
  const latRad = (lat * Math.PI) / 180;
  return Math.floor(
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * 2 ** zoom
  );
}

let cache: { expiresAt: number; data: RainViewerResponse } | null = null;

async function fetchLatestFrame(): Promise<RainViewerResponse> {
  if (cache && cache.expiresAt > Date.now()) {
    return cache.data;
  }

  const response = await fetch("https://api.rainviewer.com/public/weather-maps.json");
  if (!response.ok) {
    throw new Error(`RainViewer request failed with status ${response.status}`);
  }
  const data = (await response.json()) as RainViewerResponse;
  cache = { expiresAt: Date.now() + CACHE_TTL_MS, data };
  return data;
}

export async function getRadar(latitude: number, longitude: number): Promise<RadarData> {
  const frames = await fetchLatestFrame();
  const latest = frames.radar.past[frames.radar.past.length - 1];
  if (!latest) {
    throw new Error("No radar frames available from RainViewer");
  }

  return {
    zoom: ZOOM,
    centerTileX: lonToTileX(longitude, ZOOM),
    centerTileY: latToTileY(latitude, ZOOM),
    radarPath: latest.path,
    generatedAt: frames.generated,
  };
}
