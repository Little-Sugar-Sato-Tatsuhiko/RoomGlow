export type Period = "morning" | "daytime" | "evening" | "night";

export interface LocalVideo {
  id: number;
  name: string;
  period: Period;
  source: "local";
  path: string;
}

export interface YoutubeVideo {
  id: number;
  name: string;
  period: Period;
  source: "youtube";
  youtubeId: string;
}

export type Video = LocalVideo | YoutubeVideo;

export type VideoListItem = Video & {
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
};

export type PeriodMode = "auto" | "manual";

export interface Settings {
  autoMode: boolean;
  overlayEnabled: boolean;
  clockEnabled: boolean;
  refreshIntervalSeconds: number;
  weatherEnabled: boolean;
  weatherLatitude: number;
  weatherLongitude: number;
  radarEnabled: boolean;
  periodMode: PeriodMode;
  morningStartTime: string;
  daytimeStartTime: string;
  eveningStartTime: string;
  nightStartTime: string;
}

export interface HourlyForecast {
  time: string;
  temperatureCelsius: number;
  condition: string;
  icon: string;
}

export interface WeatherData {
  temperatureCelsius: number;
  condition: string;
  icon: string;
  hourly: HourlyForecast[];
}

export type WeatherResponse = ({ enabled: true } & WeatherData) | { enabled: false };

export interface RadarData {
  zoom: number;
  centerTileX: number;
  centerTileY: number;
  radarPath: string;
  generatedAt: number;
}

export type RadarResponse = ({ enabled: true } & RadarData) | { enabled: false };

export interface StatusResponse {
  period: Period;
  currentVideo: Video | null;
  autoMode: boolean;
  overlayEnabled: boolean;
  clockEnabled: boolean;
}

export const PERIOD_LABELS: Record<Period, string> = {
  morning: "朝",
  daytime: "昼",
  evening: "夕方",
  night: "夜",
};
