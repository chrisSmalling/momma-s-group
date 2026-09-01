import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import Nav from "@/components/Nav";
import PracticalityIcons from "@/components/PracticalityIcons";
import IndoorOutdoorTag from "@/components/IndoorOutdoorTag";
import AgeFitBadge from "@/components/AgeFitBadge";
import CostPill from "@/components/CostPill";
import { createClient } from "@/lib/supabase/server";
import { formatHours } from "@/lib/hours";
import { isGoodAgeFit, formatAgeRange } from "@/lib/ageFit";
import type { Place } from "@/types";

// RLS on `places` already restricts this select to what a parent should
// ever see (authenticated + llm_verification_status='verified' +
// geocoded + active market) -- same "verified" gate every other place
// surface (search_places, poppy_recommendation_candidates) reads,
// nothing extra to filter here.
const PLACE_COLUMNS =
  "id, name, address, hours, description, toddler_notes, price_note, age_min_months, age_max_months, website, booking_url, phone, is_outdoor, food_allowed, restrooms, parking_notes, what_to_bring, typical_crowd_note, best_time_note, category_tags, is_enclosed, has_changing_table, nursing_friendly, stroller_accessible, food_onsite, quiet_or_sensory_friendly";

export default async function PlaceDetailPage(props: PageProps<"/places/[id]">) {
  const { id } = await props.params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: place } = await supabase
    .from("places")
    .select(PLACE_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (!place) notFound();

  const { data: profile } = await supabase
    .from("profiles")
    .select("child_age_months")
    .eq("id", user.id)
    .maybeSingle();
  const childAgeMonths = profile?.child_age_months ?? null;

  const hours = formatHours(place.hours);
  const goodAgeFit = isGoodAgeFit(childAgeMonths, place.age_min_months, place.age_max_months);
  const ageRangeLabel = formatAgeRange(place.age_min_months, place.age_max_months);
  const whatToBring = place.what_to_bring ?? [];

  return (
    <div className="flex flex-1 flex-col items-center px-4 py-10">
      <div className="w-full max-w-2xl">
        <Nav email={user.email ?? ""} />
        <div className="flex flex-col gap-5">
          <Link href="/places/browse" className="text-sm font-semibold text-rose-700 hover:underline">
            ← Back to browse
          </Link>

          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-zinc-950">{place.name}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <IndoorOutdoorTag isOutdoor={place.is_outdoor} />
              {goodAgeFit && <AgeFitBadge />}
              <CostPill cost={place.price_note} />
              {ageRangeLabel && (
                <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-600">Ages {ageRangeLabel}</span>
              )}
            </div>
          </div>

          {(place.toddler_notes || place.description) && (
            <p className="text-sm leading-6 text-zinc-700">{place.toddler_notes || place.description}</p>
          )}

          <PracticalityIcons practicalities={place} />

          {place.address && (
            <div className="rounded-2xl border border-zinc-200 bg-white p-4">
              <h2 className="text-xs font-bold uppercase tracking-wide text-zinc-600">Address</h2>
              <p className="mt-1 text-sm text-zinc-700">{place.address}</p>
            </div>
          )}

          <div className="rounded-2xl border border-zinc-200 bg-white p-4">
            <h2 className="text-xs font-bold uppercase tracking-wide text-zinc-600">Hours</h2>
            {hours.length > 0 ? (
              <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-3">
                {hours.map(({ day, range }) => (
                  <div key={day} className="flex justify-between gap-2">
                    <span className="font-medium text-zinc-600">{day}</span>
                    <span className="text-zinc-700">{range}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-1 text-sm text-zinc-500">Hours unknown — check ahead.</p>
            )}
          </div>

          {(place.parking_notes || whatToBring.length > 0 || place.typical_crowd_note || place.best_time_note) && (
            <div className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-4 text-sm text-zinc-700">
              {place.parking_notes && (
                <p><span className="font-semibold text-zinc-500">Parking: </span>{place.parking_notes}</p>
              )}
              {whatToBring.length > 0 && (
                <p><span className="font-semibold text-zinc-500">Bring: </span>{whatToBring.join(", ")}</p>
              )}
              {place.typical_crowd_note && (
                <p><span className="font-semibold text-zinc-500">Typical crowd: </span>{place.typical_crowd_note}</p>
              )}
              {place.best_time_note && (
                <p><span className="font-semibold text-zinc-500">Best time: </span>{place.best_time_note}</p>
              )}
            </div>
          )}

          {(place.website || place.phone || place.booking_url) && (
            <div className="flex flex-wrap gap-3 text-sm">
              {place.website && (
                <a href={place.website} target="_blank" rel="noreferrer" className="font-semibold text-rose-700 hover:underline">
                  Website ↗
                </a>
              )}
              {place.booking_url && (
                <a href={place.booking_url} target="_blank" rel="noreferrer" className="font-semibold text-rose-700 hover:underline">
                  Book / register ↗
                </a>
              )}
              {place.phone && (
                <a href={`tel:${place.phone}`} className="font-semibold text-rose-700 hover:underline">
                  {place.phone}
                </a>
              )}
            </div>
          )}

          <Link
            href={`/places/${id}/propose`}
            className="inline-flex w-full items-center justify-center rounded-full bg-rose-600 px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-rose-700"
          >
            Propose a meetup
          </Link>
        </div>
      </div>
    </div>
  );
}
