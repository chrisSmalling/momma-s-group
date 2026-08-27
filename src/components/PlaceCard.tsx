import Link from "next/link";
import { formatHours } from "@/lib/hours";
import { isGoodAgeFit } from "@/lib/ageFit";
import { isFreeCost } from "@/lib/cost";
import { buildPlaceReason } from "@/lib/placeReason";
import PracticalityIcons from "@/components/PracticalityIcons";
import TipsSection from "@/components/TipsSection";
import IndoorOutdoorTag from "@/components/IndoorOutdoorTag";
import AgeFitBadge from "@/components/AgeFitBadge";
import MeetupDecisionMeta from "@/components/MeetupDecisionMeta";
import type { Place, PlaceTip } from "@/types";

function NoteLine({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return <p className="line-clamp-2 text-xs text-zinc-500"><span className="font-medium text-zinc-600">{label}: </span>{value}</p>;
}

type TipDisplay = PlaceTip & { display_name: string };
type Weather = { temperature: number; apparentTemperature: number; precipitationProbability: number; weatherCode: number };

type Props = {
  place: Place;
  groupId: string | null;
  groupName: string | null;
  currentUserId: string;
  tips: TipDisplay[];
  distance?: { km: number; driveMinutes?: number };
  childAgeMonths?: number | null;
  weather?: Weather | null;
};

export default function PlaceCard({ place, groupId, groupName, currentUserId, tips, distance, childAgeMonths, weather }: Props) {
  const hours = formatHours(place.hours);
  const goodAgeFit = isGoodAgeFit(childAgeMonths, place.age_min_months, place.age_max_months);
  const miles = distance?.km != null ? distance.km * 0.621371 : null;
  const reason = buildPlaceReason({ goodAgeFit, childAgeMonths, miles, isFree: isFreeCost(place.price_note) });

  return (
    <article className="overflow-hidden rounded-3xl border border-zinc-200/80 bg-white shadow-sm transition-shadow hover:shadow-md">
      <div className="p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="text-lg font-bold tracking-tight text-zinc-950 sm:text-xl">{place.name}</h3>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <IndoorOutdoorTag isOutdoor={place.is_outdoor} />
              {goodAgeFit && <AgeFitBadge />}
            </div>
            {reason && <p className="mt-1.5 text-sm font-medium text-rose-700">{reason}</p>}
          </div>
        </div>

        <MeetupDecisionMeta price={place.price_note} distance={distance} weather={weather} />

        {place.toddler_notes && <p className="mt-3 line-clamp-2 text-sm leading-5 text-zinc-600">{place.toddler_notes}</p>}
        {place.what_to_bring.length > 0 && <p className="mt-2 line-clamp-2 text-xs font-semibold text-rose-700">Bring: {place.what_to_bring.join(", ")}</p>}

        <div className="mt-3 flex flex-col gap-1.5"><PracticalityIcons practicalities={place} /><NoteLine label="Parking" value={place.parking_notes} /><NoteLine label="Best time" value={place.best_time_note} /><NoteLine label="Typical crowd" value={place.typical_crowd_note} /></div>

        {hours.length > 0 && <details className="mt-3 border-t border-zinc-100 pt-3"><summary className="cursor-pointer text-xs font-semibold text-zinc-500">Hours</summary><div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs text-zinc-500 sm:grid-cols-3">{hours.map(({ day, range }) => <div key={day} className="flex justify-between gap-2"><span className="font-medium text-zinc-600">{day}</span><span>{range}</span></div>)}</div></details>}

        <div className="mt-4 flex items-center gap-2">
          <Link href={`/places/${place.id}/propose`} className="inline-flex flex-1 items-center justify-center rounded-full bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-700">Propose a meetup</Link>
        </div>

        <details className="mt-3 border-t border-zinc-100 pt-3"><summary className="cursor-pointer text-xs font-semibold text-zinc-500">Tips {tips.length > 0 ? `(${tips.length})` : ""}</summary><div className="mt-3"><TipsSection placeId={place.id} groupId={groupId} groupName={groupName} currentUserId={currentUserId} tips={tips} /></div></details>
      </div>
    </article>
  );
}
