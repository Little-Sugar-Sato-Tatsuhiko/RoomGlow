const CACHE_TTL_MS = 10 * 60 * 1000;
const HOURLY_FORECAST_COUNT = 6;

interface HourlyForecast {
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
  isRainy: boolean;
}

interface OpenMeteoResponse {
  current: {
    time: string;
    temperature_2m: number;
    weather_code: number;
  };
  hourly: {
    time: string[];
    temperature_2m: number[];
    weather_code: number[];
  };
}

const WEATHER_CODE_LABELS: Record<number, { condition: string; icon: string }> = {
  0: { condition: "快晴", icon: "☀️" },
  1: { condition: "ほぼ晴れ", icon: "🌤️" },
  2: { condition: "晴れ時々曇り", icon: "⛅" },
  3: { condition: "曇り", icon: "☁️" },
  45: { condition: "霧", icon: "🌫️" },
  48: { condition: "霧（着氷）", icon: "🌫️" },
  51: { condition: "小雨", icon: "🌦️" },
  53: { condition: "霧雨", icon: "🌦️" },
  55: { condition: "強い霧雨", icon: "🌦️" },
  56: { condition: "着氷性の霧雨", icon: "🌧️" },
  57: { condition: "強い着氷性の霧雨", icon: "🌧️" },
  61: { condition: "小雨", icon: "🌧️" },
  63: { condition: "雨", icon: "🌧️" },
  65: { condition: "強い雨", icon: "🌧️" },
  66: { condition: "着氷性の雨", icon: "🌧️" },
  67: { condition: "強い着氷性の雨", icon: "🌧️" },
  71: { condition: "小雪", icon: "🌨️" },
  73: { condition: "雪", icon: "❄️" },
  75: { condition: "強い雪", icon: "❄️" },
  77: { condition: "霧雪", icon: "❄️" },
  80: { condition: "にわか雨", icon: "🌦️" },
  81: { condition: "強いにわか雨", icon: "🌧️" },
  82: { condition: "激しいにわか雨", icon: "⛈️" },
  85: { condition: "にわか雪", icon: "🌨️" },
  86: { condition: "強いにわか雪", icon: "❄️" },
  95: { condition: "雷雨", icon: "⛈️" },
  96: { condition: "雷雨（ひょう）", icon: "⛈️" },
  99: { condition: "激しい雷雨（ひょう）", icon: "⛈️" },
};

function describeWeatherCode(code: number): { condition: string; icon: string } {
  return WEATHER_CODE_LABELS[code] ?? { condition: "不明", icon: "🌡️" };
}

// Rain/drizzle/thunderstorm codes (excludes fog, snow, and clear/cloudy codes)
// used to gate the rain radar overlay so it only shows when rain is actually forecast.
const RAIN_CODES = new Set([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99]);

function isRainCode(code: number): boolean {
  return RAIN_CODES.has(code);
}

async function fetchWeather(latitude: number, longitude: number): Promise<WeatherData> {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(latitude));
  url.searchParams.set("longitude", String(longitude));
  url.searchParams.set("current", "temperature_2m,weather_code");
  url.searchParams.set("hourly", "temperature_2m,weather_code");
  url.searchParams.set("forecast_days", "2");
  url.searchParams.set("timezone", "auto");

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Open-Meteo request failed with status ${response.status}`);
  }
  const data = (await response.json()) as OpenMeteoResponse;

  const currentLabel = describeWeatherCode(data.current.weather_code);
  const startIndex = data.hourly.time.findIndex((time) => time >= data.current.time);
  const hourlySlice = startIndex === -1 ? [] : data.hourly.time.slice(startIndex + 1, startIndex + 1 + HOURLY_FORECAST_COUNT);

  const hourly: HourlyForecast[] = hourlySlice.map((time, index) => {
    const i = startIndex + 1 + index;
    const label = describeWeatherCode(data.hourly.weather_code[i]);
    return {
      time: time.split("T")[1] ?? time,
      temperatureCelsius: data.hourly.temperature_2m[i],
      condition: label.condition,
      icon: label.icon,
    };
  });

  const isRainy =
    isRainCode(data.current.weather_code) ||
    hourlySlice.some((_, index) => isRainCode(data.hourly.weather_code[startIndex + 1 + index]));

  return {
    temperatureCelsius: data.current.temperature_2m,
    condition: currentLabel.condition,
    icon: currentLabel.icon,
    hourly,
    isRainy,
  };
}

let cache: { key: string; expiresAt: number; data: WeatherData } | null = null;

export async function getWeather(latitude: number, longitude: number): Promise<WeatherData> {
  const key = `${latitude},${longitude}`;
  if (cache && cache.key === key && cache.expiresAt > Date.now()) {
    return cache.data;
  }

  const data = await fetchWeather(latitude, longitude);
  cache = { key, expiresAt: Date.now() + CACHE_TTL_MS, data };
  return data;
}
