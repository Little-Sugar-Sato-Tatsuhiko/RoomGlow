import type { WeatherData } from "../types.ts";

interface Props {
  data?: WeatherData;
}

export default function WeatherWidget({ data }: Props) {
  if (!data) return null;

  return (
    <div className="weather-widget">
      <div className="weather-widget__current">
        <span className="weather-widget__icon">{data.icon}</span>
        <span className="weather-widget__temperature">{Math.round(data.temperatureCelsius)}°C</span>
        <span className="weather-widget__condition">{data.condition}</span>
      </div>
      {data.hourly.length > 0 && (
        <div className="weather-widget__hourly">
          {data.hourly.map((hour) => (
            <div key={hour.time} className="weather-widget__hour">
              <span className="weather-widget__hour-time">{hour.time}</span>
              <span className="weather-widget__hour-icon">{hour.icon}</span>
              <span className="weather-widget__hour-temp">{Math.round(hour.temperatureCelsius)}°</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
