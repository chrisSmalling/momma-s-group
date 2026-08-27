import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isFreeCost } from "@/lib/cost";
import { parseIntent } from "@/lib/recommend/intent";
import { filterPlaces } from "@/lib/recommend/filter";
import { goodAgeFit, scorePlace } from "@/lib/recommend/score";
import type { PoppyProfile, RecommendationCandidate } from "@/lib/recommend/types";
import type { Place } from "@/types";

const MAX_RESULTS = 3;
const MAX_POOL = 250;
const SERVICE_RADIUS_MILES = 30;

function toProfile(row: Record<string, unknown> | null): PoppyProfile {
  const arr = (v: unknown) => Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  const num = (v: unknown) => typeof v === "number" && Number.isFinite(v) ? v : null;
  const str = (v: unknown) => typeof v === "string" && v.trim() ? v : null;
  return {
    childAgeMonths: num(row?.child_age_months), childInterests: arr(row?.child_interests), childActivityPreferences: arr(row?.child_activity_preferences),
    preferredCategories: arr(row?.preferred_categories), preferredPlaceTypes: arr(row?.preferred_place_types), indoorPreference: row?.indoor_preference === "indoor" || row?.indoor_preference === "outdoor" ? row.indoor_preference : "either",
    maxDistanceMiles: num(row?.max_distance_miles), familyBudgetNote: str(row?.family_budget_note), napStart: str(row?.nap_start), napEnd: str(row?.nap_end), homeLat: num(row?.home_lat), homeLng: num(row?.home_lng),
  };
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  let body: Record<string, unknown> = {};
  try { body = (await request.json()) as Record<string, unknown>; } catch { /* empty request is valid */ }
  const message = typeof body.message === "string" ? body.message.slice(0, 400) : "";
  const originMode = body.originMode === "current" ? "current" : "home";
  const { data: profileRow, error: profileError } = await supabase.from("profiles").select("child_age_months, child_interests, child_activity_preferences, preferred_categories, preferred_place_types, indoor_preference, max_distance_miles, family_budget_note, nap_start, nap_end, home_lat, home_lng").eq("id", user.id).maybeSingle();
  if (profileError) return NextResponse.json({ error: "Could not load your Poppy profile." }, { status: 500 });
  const profile = toProfile(profileRow as Record<string, unknown> | null);
  let origin = profile.homeLat != null && profile.homeLng != null ? { lat: profile.homeLat, lng: profile.homeLng } : null;
  if (originMode === "current") { const supplied = body.origin as Record<string, unknown> | undefined; if (supplied && typeof supplied.lat === "number" && typeof supplied.lng === "number" && Number.isFinite(supplied.lat) && Number.isFinite(supplied.lng)) origin = { lat: supplied.lat, lng: supplied.lng }; }
  const constraints = parseIntent(message);
  constraints.maxMiles = Math.min(constraints.maxMiles ?? profile.maxDistanceMiles ?? SERVICE_RADIUS_MILES, SERVICE_RADIUS_MADIUS);
  const { data: rows, error } = await supabase.from("places").select("*").eq("active", true).eq("llm_verification_status", "verified").limit(MAX_POOL);
  if (error) return NextResponse.json({ error: "Could not load family places." }, { status: 500 });
  const filtered = filterPlaces((rows ?? []) as Place[], constraints, origin);
  const ranked = filtered.kept.map(({ place, miles }) => ({ place, miles, score: scorePlace(place, miles, constraints, profile, null) })).sort((a, b) => b.score - a.score).slice(0, MAX_RESULTS);
  const candidates: RecommendationCandidate[] = ranked.map(({ place, miles, score }) => {
    const fit = goodAgeFit(profile.childAgeMonths, place.age_min_months, place.age_max_months);
    const interest = profile.childInterests.find(i => { const tags: Record<string, string[]> = { playgrounds: ["playground"], water: ["water_play"], adventure: ["active_play", "outdoor"], sports: ["active_play", "playground"], animals: ["animals"], books: ["storytime"], arts_and_crafts: ["arts_learning"], science: ["arts_learning"], music: ["arts_learning"] }; return (tags[i] ?? []).some(tag => place.category_tags.includes(tag)); });
    const reasons = [fit && profile.childAgeMonths != null ? "fits their age" : null, interest ? `matches ${interest.replaceAll("_", " ")}` : null, isFreeCost(place.price_note) ? "free" : null, miles != null ? `${miles < 10 ? miles.toFixed(1) : Math.round(miles)} mi away` : null].filter(Boolean);
    return { type: "place", id: place.id, title: place.name, description: place.toddler_notes ?? place.description, address: place.address, distanceMiles: miles, driveMinutes: null, distanceLabel: miles == null ? null : `~${miles < 10 ? miles.toFixed(1) : Math.round(miles)} mi away`, startsAt: null, endsAt: null, price: place.price_note, isFree: isFreeCost(place.price_note), isOutdoor: place.is_outdoor, ageMinMonths: place.age_min_months, ageMaxMonths: place.age_max_months, goodAgeFit: fit, reason: reasons.length ? `Good option — ${reasons.join(" · ")}.` : "A family-friendly option.", href: `/places/${place.id}`, lastVerifiedAt: place.last_verified_at, score, whatToBring: place.what_to_bring ?? [], strollerAccessible: place.stroller_accessible, changingTable: place.has_changing_table, nursingFriendly: place.nursing_friendly, parkingNotes: place.parking_notes, typicalCrowdNote: place.typical_crowd_note, bestTimeNote: place.best_time_note, registrationRequired: false };
  });
  return NextResponse.json({ candidates, source: "evergreen-places" });
}
