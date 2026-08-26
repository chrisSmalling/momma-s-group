import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { FeedEvent } from "@/types";
import { isFreeCost } from "@/lib/cost";
import { parseIntent } from "@/lib/recommend/intent";
import { buildFallbacks, buildResponseText, recommend } from "@/lib/recommend/recommend";
import type { PoppyProfile, RecommendationConstraints } from "@/lib/recommend/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MESSAGE_MAX = 400;
const CANDIDATE_POOL = 500;

// This route exists only to make preview acceptance testing possible without
// creating an authenticated browser session. It is deliberately disabled on
// production and never records/cache-writes recommendation state.
function previewOnly() {
  return process.env.VERCEL_ENV === "preview";
}

type CandidateRow = {
  id: string; title: string | null; display_title: string | null; description: string | null;
  venue_name: string | null; venue_display: string | null; address: string | null;
  location_city: string | null; lat: number | null; lng: number | null;
  location_latitude: number | null; location_longitude: number | null;
  starts_at: string; ends_at: string | null; age_min_months: number | null;
  age_max_months: number | null; age_band: string | null; age_tags: string[] | null;
  cost: string | null; source: string | null; source_url: string | null;
  registration_required: boolean; registration_url: string | null; is_outdoor: boolean;
  experience_type: string | null; weather_fit: string | null; verification_tier: string | null;
  content_review_status: string | null; last_verified_at: string | null;
  place_id: string | null; program_id: string | null;
};

function toEvent(row: CandidateRow): FeedEvent {
  return {
    id: row.id,
    title: row.display_title?.trim() || row.title?.trim() || "Family activity",
    description: row.description,
    venue: row.venue_display?.trim() || row.venue_name?.trim() || null,
    room_name: null, organizer: null, address: row.address,
    lat: row.lat ?? row.location_latitude, lng: row.lng ?? row.location_longitude,
    location_latitude: row.location_latitude ?? row.lat,
    location_longitude: row.location_longitude ?? row.lng,
    starts_at: row.starts_at, ends_at: row.ends_at, time_precision: "datetime",
    time_unknown: false, cost: row.cost, is_free: isFreeCost(row.cost),
    age_tags: row.age_tags ?? [], age_min_months: row.age_min_months,
    age_max_months: row.age_max_months, age_band: row.age_band,
    is_outdoor: row.is_outdoor, what_to_bring: [],
    registration_required: row.registration_required, registration_url: row.registration_url,
    source: row.source ?? "", source_id: null, source_url: row.source_url,
    content_status: row.content_review_status, geography_tier: row.verification_tier,
    experience_type: row.experience_type, weather_fit: row.weather_fit,
    place_id: row.place_id, program_id: row.program_id, proposed_by_group: null,
    metro_area: row.location_city ?? "", status: "published", last_verified_at: row.last_verified_at,
    added_by: null,
  };
}

const QA_PROFILE: PoppyProfile = {
  childAgeMonths: 24,
  childInterests: ["animals", "playgrounds", "water"],
  childActivityPreferences: ["play", "outdoors", "learning"],
  preferredCategories: [], preferredPlaceTypes: [], indoorPreference: "either",
  maxDistanceMiles: 30, familyBudgetNote: "", napStart: null, napEnd: null,
  homeLat: 28.1900, homeLng: -82.3000,
};

export async function POST(request: Request) {
  if (!previewOnly()) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return NextResponse.json({ error: "QA environment is not configured." }, { status: 503 });

  let body: Record<string, unknown>;
  try { body = (await request.json()) as Record<string, unknown>; }
  catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }

  const message = typeof body.message === "string" ? body.message.slice(0, MESSAGE_MAX) : "";
  const previous = body.previous && typeof body.previous === "object"
    ? body.previous as Partial<RecommendationConstraints> : undefined;
  const origin = QA_PROFILE.homeLat != null && QA_PROFILE.homeLng != null
    ? { lat: QA_PROFILE.homeLat, lng: QA_PROFILE.homeLng } : null;
  const now = new Date();
  const constraints = parseIntent(message, previous);
  if (constraints.maxMiles == null && QA_PROFILE.maxDistanceMiles != null) constraints.maxMiles = QA_PROFILE.maxDistanceMiles;

  try {
    const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data: rows, error } = await admin.from("poppy_recommendation_candidates")
      .select("id, title, display_title, description, venue_name, venue_display, address, location_city, lat, lng, location_latitude, location_longitude, starts_at, ends_at, age_min_months, age_max_months, age_band, age_tags, cost, source, source_url, registration_required, registration_url, is_outdoor, experience_type, weather_fit, verification_tier, content_review_status, last_verified_at, place_id, program_id")
      .gte("starts_at", now.toISOString()).order("starts_at", { ascending: true }).limit(CANDIDATE_POOL);
    if (error) throw error;

    const eventList = ((rows ?? []) as CandidateRow[]).map(toEvent);
    const { candidates, droppedCount } = recommend({ places: [], events: eventList }, constraints, QA_PROFILE, origin, null, now);
    const result = {
      requestId: "qa-preview",
      intent: constraints,
      candidates,
      responseText: buildResponseText(candidates, constraints, "your 2-year-old"),
      fallbacks: candidates.length === 0 ? buildFallbacks(constraints) : [],
      cacheHit: false,
      qa: true,
      candidatePool: eventList.length,
      droppedCount,
    };
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[poppy-qa] recommendation failed", error);
    return NextResponse.json({ error: "Something went wrong while Poppy was looking." }, { status: 500 });
  }
}
