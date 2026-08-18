import Link from "next/link";
import { formatHours } from "@/lib/hours";
import type { Place } from "@/types";

export default function PlaceCard({ place }: { place: Place }) {
  const hours = formatHours(place.hours);

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4">
      <h3 className="text-lg font-bold text-zinc-900">{place.name}</h3>

      {place.description && (
        <p className="mt-1 text-sm text-zinc-600">{place.description}</p>
      )}

      {place.toddler_notes && (
        <p className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {place.toddler_notes}
        </p>
      )}

      {place.price_note && (
        <p className="mt-2 text-xs font-medium text-amber-700">
          {place.price_note}
        </p>
      )}

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

      <Link
        href={`/places/${place.id}/propose`}
        className="mt-4 inline-block rounded-full bg-rose-600 px-4 py-1.5 text-sm font-medium text-white shadow-sm"
      >
        Propose a meetup
      </Link>
    </div>
  );
}
