type Weather = {
  temperature: number;
  apparentTemperature: number;
  precipitationProbability: number;
  weatherCode: number;
};

type Distance = { km: number; driveMinutes?: number };

function weatherLabel(weather: Weather) {
  if (weather.precipitationProbability >= 60 || weather.weatherCode >= 80) return "Rain likely";
  if (weather.apparentTemperature >= 92) return "Warm day";
  if (weather.apparentTemperature <= 55) return "Cool day";
  return "Good weather";
}

export default function MeetupDecisionMeta({
  price,
  distance,
  weather,
}: {
  price?: string | null;
  distance?: Distance | null;
  weather?: Weather | null;
}) {
  const hasPrice = Boolean(price?.trim());
  const hasDistance = Boolean(distance);
  const hasWeather = Boolean(weather);

  if (!hasPrice && !hasDistance && !hasWeather) return null;

  return (
    <div className="mt-3 rounded-xl bg-zinc-50 px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-semibold text-zinc-700">
        {hasPrice && <span className="text-emerald-700">💰 {price}</span>}
        {hasWeather && weather && (
          <span>
            {weather.precipitationProbability >= 60 || weather.weatherCode >= 80 ? "🌧️" : weather.apparentTemperature >= 92 ? "☀️" : "🌤️"} {Math.round(weather.temperature)}°
          </span>
        )}
        {hasDistance && distance && (
          <span>🚗 {distance.driveMinutes !== undefined ? `${Math.round(distance.driveMinutes)} min` : `${distance.km.toFixed(1)} mi`}</span>
        )}
      </div>
      {hasWeather && weather && (
        <p className="mt-1 text-[11px] font-medium text-zinc-500">{weatherLabel(weather)} at the event</p>
      )}
    </div>
  );
}
