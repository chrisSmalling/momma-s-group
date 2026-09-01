import Link from "next/link";
import { formatTodayHours } from "@/lib/hours";
import PracticalityIcons from "@/components/PracticalityIcons";
import IndoorOutdoorTag from "@/components/IndoorOutdoorTag";
import AgeFitBadge from "@/components/AgeFitBadge";
import CostPill from "@/components/CostPill";
import type { PlaceSearchResult } from "@/lib/places/search";

function distanceLabel(miles: number | null): string | null {
  if (miles == null) return null;
  return `~${miles < 10 ? miles.toFixed(1) : Math.round(miles)} mi away`;
}

function driveLabel(minutes: number | null): string | null {
  if (minutes == null) return null;
  return `~${Math.round(minutes)} min drive`;
}

export default function PlaceSearchCard({ result }: { result: PlaceSearchResult }) {
  const { place, miles, driveMinutes, goodAgeFit } = result;
  const todayHours = formatTodayHours(place.hours);

  return (
    <article className="overflow-hidden rounded-3xl border border-zinc-200/80 bg-white shadow-sm transition-shadow hover:shadow-md">
      <Link href={`/places/${place.id}`} className="block p-4 sm:p-5">
        <h3 className="text-lg font-bold tracking-tight text-zinc-950 sm:text-xl">{place.name}</h3>

        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <IndoorOutdoorTag isOutdoor={place.is_outdoor} />
          {goodAgeFit && <AgeFitBadge />}
          <CostPill cost={place.price_note} />
        </div>

        {(driveLabel(driveMinutes) || distanceLabel(miles)) && (
          <p className="mt-2 text-xs font-medium text-zinc-500">{driveLabel(driveMinutes) ?? distanceLabel(miles)}</p>
        )}

        {place.toddler_notes && <p className="mt-3 line-clamp-2 text-sm leading-5 text-zinc-600">{place.toddler_notes}</p>}

        <div className="mt-3"><PracticalityIcons practicalities={place} /></div>

        <div className="mt-3 border-t border-zinc-100 pt-3 text-xs font-semibold text-zinc-500">
          {todayHours ?? "Hours unknown"}
        </div>
      </Link>

      <div className="px-4 pb-4 sm:px-5 sm:pb-5">
        <Link
          href={`/places/${place.id}/propose`}
          className="inline-flex w-full items-center justify-center rounded-full bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-700"
        >
          Propose a meetup
        </Link>
      </div>
    </article>
  );
}
