// Shared place-search backbone. The ONE function both the Poppy
// natural-language path (/api/poppy/recommend) and the Places directory UI
// (/places/browse) call, so the two surfaces can never answer the same
// query differently.
//
// Backed by the search_places() SQL function (search_places migration),
// which does a plain ILIKE scan across name/description/toddler_notes/
// category_tags — fine at 102 active places; see that migration's comment
// for when to add an index. RLS on `places` (verified + geocoded +
// active-market only) applies automatically since search_places runs with
// invoker rights, not security definer.
import { isGoodAgeFit } from "@/lib/ageFit";
import { applyAgeGate } from "@/lib/ageGate";
import { milesBetween } from "@/lib/recommend/filter";
import { applyDriveTimeGate } from "@/lib/routing/driveTimeGate";
import type { createClient } from "@/lib/supabase/server";
import type { Place } from "@/types";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

export interface PlaceSearchOptions {
  term?: string | null;
  tags?: string[] | null;
  origin?: { lat: number; lng: number } | null;
  childAgeMonths?: number | null;
  limit?: number;
}

export interface PlaceSearchResult {
  place: Place;
  miles: number | null;
  driveMinutes: number | null;
  goodAgeFit: boolean;
}

export interface PlaceSearchOutcome {
  results: PlaceSearchResult[];
  // false only when an origin was known but the routed 45-minute gate
  // couldn't be evaluated (routing unavailable/failed) — callers must show
  // an honest "can't verify drive times right now" message, not an empty
  // "nothing found" one, since those mean different things to a parent.
  routingAvailable: boolean;
}

const DEFAULT_LIMIT = 30;

export async function searchPlaces(
  supabase: SupabaseClient,
  options: PlaceSearchOptions,
): Promise<PlaceSearchOutcome> {
  const term = options.term?.trim() || null;
  const tags = options.tags?.length ? options.tags : null;
  const origin = options.origin ?? null;

  const { data, error } = await supabase.rpc("search_places", {
    p_term: term,
    p_tags: tags,
    p_limit: options.limit ?? DEFAULT_LIMIT,
  });
  if (error) throw error;

  const places = (data ?? []) as Place[];
  const gate = await applyDriveTimeGate(places, origin);
  if (origin && !gate.available) return { results: [], routingAvailable: false };

  // Hard toddler age-fit gate — same one applied on every surface (see
  // src/lib/ageGate.ts). A KNOWN child age still excludes places with no
  // stated range (can't confirm fit); with no saved child age, a place
  // with no range at all now passes through (it's already been
  // evidence-vetted as toddler-appropriate by apply_place_toddler_gate —
  // see ageGate.ts's own comment for why "no item data" stopped being a
  // hard exclude in the no-profile case, fixed 2026-08-31 after it broke
  // the places directory outright).
  const ageAppropriate = applyAgeGate(gate.kept, options.childAgeMonths ?? null);

  const results: PlaceSearchResult[] = ageAppropriate.map((place) => ({
    place,
    miles: milesBetween(origin, place),
    driveMinutes: gate.driveMinutesById.get(place.id) ?? null,
    goodAgeFit: isGoodAgeFit(options.childAgeMonths ?? null, place.age_min_months, place.age_max_months),
  }));

  return { results, routingAvailable: true };
}
