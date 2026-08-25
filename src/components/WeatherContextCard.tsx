import type { WeatherContext } from "@/lib/weather-context";

export default function WeatherContextCard({ weather }: { weather: WeatherContext | null }) {
  if (!weather) return null;
  const icon = weather.severe ? "⛈️" : weather.rainNow || weather.precipitationProbability >= 60 ? "🌧️" : weather.temperatureF >= 88 ? "☀️" : "🌤️";
  return (
    <section className="rounded-2xl border border-sky-100 bg-sky-50/70 px-4 py-3">
      <div className="flex items-start gap-3">
        <div className="text-xl" aria-hidden="true">{icon}</div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <h2 className="text-sm font-bold text-zinc-900">Today&apos;s family weather</h2>
            <span className="text-xs font-semibold text-zinc-500">{Math.round(weather.temperatureF)}° · feels {Math.round(weather.feelsLikeF)}°</span>
          </div>
          <p className="mt-1 text-sm leading-5 text-zinc-700">{weather.summary}</p>
          {weather.precipitationProbability > 0 && <p className="mt-1 text-xs text-zinc-500">Rain chance over the next few hours: {weather.precipitationProbability}%.</p>}
        </div>
      </div>
    </section>
  );
}
