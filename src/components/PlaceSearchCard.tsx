import Link from "next/link";
import { formatHours } from "@/lib/hours";
import { isFreeCost } from "@/lib/cost";
import PracticalityIcons from "@/components/PracticalityIcons";
import IndoorOutdoorTag from "@/components/IndoorOutdoorTag";
import AgeFitBadge from "@/components/AgeFitBadge";
import type { PlaceSearchResult } from "@/lib/places/search";

function distanceLabel(miles: number | null): string | null {
  if (miles == null) return null;
  return `~${miles < 10 ? miles.toFixed(1) : Math.round(miles)} mi away`;
}

function driveLabel(minutes: number | null): string | null {
  if (minutes == null) return null;
  return `~${Math.round(minutes)} min drive`;
}

// Used only here, not the rest of the app: a search-results grid is where a
// parent is actively weighing options, so a plain "unknown" for the two
// facts they're most likely deciding on (cost, hours) is more useful than
// this app's usual "omit the field entirely" convention (see PracticalityIcons).
function CostLine({ priceNote }: { priceNote: string | null }) {
  if (priceNote?.trim()) {
    return isFreeCost(priceNote)
      ? <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">Free</span>
      : <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-800">{priceNote.trim()}</span>;
  }
  return <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-500">Cost unknown</span>;
}

export default function PlaceSearchCard({ result }: { result: PlaceSearchResult }) {
  const { place, miles, driveMinutes, goodAgeFit } = result;
  const hours = formatHours(place.hours);

  return (
    <article className="overflow-hidden rounded-3xl border border-zinc-200/80 bg-white shadow-sm transition-shadow hover:shadow-md">
      <div className="p-4 sm:p-5">
        <h3 className="text-lg font-bold tracking-tight text-zinc-950 sm:text-xl">{place.name}</h3>

        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <IndoorOutdoorTag isOutdoor={place.is_outdoor} />
          {goodAgeFit && <AgeFitBadge />}
          <CostLine priceNote={place.price_note} />
        </div>

        {(driveLabel(driveMinutes) || distanceLabel(miles)) && (
          <p className="mt-2 text-xs font-medium text-zinc-500">{driveLabel(driveMinutes) ?? distanceLabel(miles)}</p>
        )}

        {place.toddler_notes && <p className="mt-3 line-clamp-2 text-sm leading-5 text-zinc-600">{place.toddler_notes}</p>}

        <div className="mt-3"><PracticalityIcons practicalities={place} /></div>

        <div className="mt-3 border-t border-zinc-100 pt-3 text-xs text-zinc-500">
          {hours.length > 0 ? (
            <details>
              <summary className="cursor-pointer font-semibold text-zinc-500">Hours</summary>
              <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-0.5 sm:grid-cols-3">
                {hours.map(({ day, range }) => (
                  <div key={day} className="flex justify-between gap-2">
                    <span className="font-medium text-zinc-600">{day}</span>
                    <span>{range}</span>
                  </div>
                ))}
              </div>
            </details>
          ) : (
            <span className="font-semibold text-zinc-500">Hours unknown</span>
          )}
        </div>

        <div className="mt-4">
          <Link
            href={`/places/${place.id}/propose`}
            className="inline-flex w-full items-center justify-center rounded-full bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-700"
          >
            Propose a meetup
          </Link>
        </div>
      </div>
    </article>
  );
}
