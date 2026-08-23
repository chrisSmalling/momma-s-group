import Link from "next/link";
import { formatHours } from "@/lib/hours";
import { formatDistance, formatDriveTime } from "@/lib/distance";
import { isGoodAgeFit } from "@/lib/ageFit";
import PracticalityIcons from "@/components/PracticalityIcons";
import TipsSection from "@/components/TipsSection";
import IndoorOutdoorTag from "@/components/IndoorOutdoorTag";
import AgeFitBadge from "@/components/AgeFitBadge";
import type { Place, PlaceTip } from "@/types";

function NoteLine({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <p className="text-xs text-zinc-500">
      <span className="font-medium text-zinc-600">{label}: </span>
      {value}
    </p>
  );
}

type TipDisplay = PlaceTip & { display_name: string };
type Weather = { temperature: number; apparentTemperature: number; precipitationProbability: number; weatherCode: number };

function weatherSummary(weather: Weather) {
  const wet = weather.precipitationProbability >= 60 || weather.weatherCode >= 80;
  const hot = weather.apparentTemperature >= 92;
  if (wet) return `🌧️ ${weather.precipitationProbability}% rain`;
  if (hot) return `🔥 Feels like ${Math.round(weather.apparentTemperature)}°`;
  return `☀️ ${Math.round(weather.temperature)}°`;
}

export default function PlaceCard({
  place,
  groupId,
  groupName,
  currentUserId,
  tips,
  distance,
  childAgeMonths,
  weather,
}: {
  place: Place;
  groupId: string | null;
  groupName: string | null;
  currentUserId: string;
  tips: TipDisplay[];
  distance?: { km: number; driveMinutes?: number };
  childAgeMonths?: number | null;
  weather?: Weather | null;
}) {
  const hours = formatHours(place.hours);
  const goodAgeFit = isGoodAgeFit(childAgeMonths, place.age_min_months, place.age_max_months);

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-lg font-bold text-zinc-900">{place.name}</h3>
        {distance !== undefined && (
          <span className="shrink-0 text-xs text-zinc-400">
            {distance.driveMinutes !== undefined ? formatDriveTime(distance.driveMinutes) : formatDistance(distance.km)}
          </span>
        )}
      </div>

      <div className="mt-1 flex flex-wrap items-center gap-1.5">
        <IndoorOutdoorTag isOutdoor={place.is_outdoor} />
        {goodAgeFit && <AgeFitBadge />}
      </div>

      {weather && <p className="mt-1.5 text-xs font-medium text-zinc-600">{weatherSummary(weather)} at the place now</p>}

      {place.description && <p className="mt-1 line-clamp-1 text-sm text-zinc-600">{place.description}</p>}

      {place.toddler_notes && <p className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">{place.toddler_notes}</p>}

      {place.price_note && <p className="mt-2 text-xs font-medium text-amber-700">{place.price_note}</p>}

      {place.what_to_bring.length > 0 && <p className="mt-2 text-sm font-semibold text-rose-700">Bring: {place.what_to_bring.join(", ")}</p>}

      <div className="mt-2 flex flex-col gap-1.5">
        <PracticalityIcons practicalities={place} />
        <NoteLine label="Parking" value={place.parking_notes} />
        <NoteLine label="Best time" value={place.best_time_note} />
        <NoteLine label="Typical crowd" value={place.typical_crowd_note} />
      </div>

      {hours.length > 0 && (
        <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs text-zinc-500 sm:grid-cols-3">
          {hours.map(({ day, range }) => (
            <div key={day} className="flex justify-between gap-2">
              <span className="font-medium text-zinc-600">{day}</span>
              <span>{range}</span>
            </div>
          ))}
        </div>
      )}

      <Link href={`/places/${place.id}/propose`} className="mt-4 inline-block rounded-full bg-rose-600 px-4 py-1.5 text-sm font-medium text-white shadow-sm">
        Propose a meetup
      </Link>

      <details className="mt-3 border-t border-zinc-100 pt-3">
        <summary className="cursor-pointer text-xs font-semibold text-zinc-500">Tips {tips.length > 0 ? `(${tips.length})` : ""}</summary>
        <div className="mt-3">
          <TipsSection placeId={place.id} groupId={groupId} groupName={groupName} currentUserId={currentUserId} tips={tips} />
        </div>
      </details>
    </div>
  );
}
