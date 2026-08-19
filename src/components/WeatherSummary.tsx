type Weather = {
  temperature: number;
  apparentTemperature: number;
  precipitationProbability: number;
  weatherCode: number;
};

function weatherLabel(code: number) {
  if (code === 0) return "Clear";
  if (code <= 3) return "Partly cloudy";
  if (code <= 48) return "Cloudy";
  if (code <= 57) return "Drizzle";
  if (code <= 67) return "Rain";
  if (code <= 77) return "Wintry";
  if (code <= 82) return "Showers";
  if (code <= 86) return "Snow showers";
  if (code >= 95) return "Thunderstorms";
  return "Mixed conditions";
}

function weatherTone(weather: Weather) {
  if (weather.precipitationProbability >= 60 || weather.weatherCode >= 80) {
    return "Rain likely — indoor options get a boost.";
  }
  if (weather.apparentTemperature >= 92) {
    return "Hot today — indoor and water options get a boost.";
  }
  if (weather.apparentTemperature >= 86) {
    return "Warm today — look for shade, water, or indoor play.";
  }
  return "Looks like a good day to get out.";
}

export default function WeatherSummary({ weather }: { weather: Weather | null }) {
  if (!weather) return null;

  return (
    <div className="mb-6 rounded-2xl border border-zinc-200 bg-white px-4 py-3 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-zinc-900">
            {Math.round(weather.temperature)}° · {weatherLabel(weather.weatherCode)}
          </p>
          <p className="mt-1 text-xs text-zinc-500">{weatherTone(weather)}</p>
        </div>
        <div className="text-right text-xs text-zinc-500">
          <p>Feels {Math.round(weather.apparentTemperature)}°</p>
          <p>{weather.precipitationProbability}% rain</p>
        </div>
      </div>
    </div>
  );
}
