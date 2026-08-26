import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getRoutingProvider } from "@/lib/routing";
import { getWeatherContext, type WeatherContext } from "@/lib/weather-context";
import type { FeedEvent, Place } from "@/types";
import { parseIntent } from "@/lib/recommend/intent";
import { buildCacheKey } from "@/lib/recommend/cacheKey";
import { buildFallbacks, buildResponseText, recommend } from "@/lib/recommend/recommend";
import { generatePoppyLine } from "@/lib/recommend/poppyText.server";
import type {
  IndoorPreference,
  Mood,
  PoppyProfile,
  RecommendationConstraints,
  RecommendationResult,
} from "@/lib/recommend/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MESSAGE_MAX = 400;
const CANDIDATE_POOL = 300;
const EVENT_WINDOW_DAYS = 8;
const CACHE_TTL_MINUTES = 15;

const MOODS: Mood[] = ["all", "indoor", "outdoor", "water", "active", "learn", "create", "animals"];
const INDOOR: IndoorPreference[] = ["indoor", "outdoor", "either"];

// Only these fields of a client-supplied "previous" constraint set are
// trusted, and only after being validated against the allowed value sets. A
// malformed follow-up context can never inject arbitrary data.
function sanitizePrevious(input: unknown): Partial<RecommendationConstraints> | undefined {
  if (!input || typeof input !== "object") return undefined;
  const raw = input as Record<string, unknown>;
  const out: Partial<RecommendationConstraints> = {};
  if (typeof raw.mood === "string" && MOODS.includes(raw.mood as Mood)) out.mood = raw.mood as Mood;
  if (typeof raw.indoor === "string" && INDOOR.includes(raw.indoor as IndoorPreference)) out.indoor = raw.indoor as IndoorPreference;
  if (raw.budget === "free" || raw.budget === "budget" || raw.budget === "any") out.budget = raw.budget;
  if (raw.timeframe === "today" || raw.timeframe === "tomorrow" || raw.timeframe === "weekend" || raw.timeframe === "any") out.timeframe = raw.timeframe;
  if (typeof raw.maxMiles === "number" && Number.isFinite(raw.maxMiles) && raw.maxMiles > 0 && raw.maxMiles <= 200) out.maxMiles = raw.maxMiles;
  if (raw.maxMiles === null) out.maxMiles = null;
  if (typeof raw.indoorExplicit === "boolean") out.indoorExplicit = raw.indoorExplicit;
  return out;
}

function toProfile(row: Record<string, unknown> | null): PoppyProfile {
  const arr = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
  const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
  const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v : null);
  const indoorPref = row?.indoor_preference;
  return {
    childAgeMonths: num(row?.child_age_months),
    childInterests: arr(row?.child_interests),
    childActivityPreferences: arr(row?.child_activity_preferences),
    preferredCategories: arr(row?.preferred_categories),
    preferredPlaceTypes: arr(row?.preferred_place_types),
    indoorPreference: indoorPref === "indoor" || indoorPref === "outdoor" ? indoorPref : "either",
    maxDistanceMiles: num(row?.max_distance_miles),
    familyBudgetNote: str(row?.family_budget_note),
    napStart: str(row?.nap_start),
    napEnd: str(row?.nap_end),
    homeLat: num(row?.home_lat),
    homeLng: num(row?.home_lng),
  };
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const message = typeof body.message === "string" ? body.message.slice(0, MESSAGE_MAX) : "";
  const previous = sanitizePrevious(body.previous);
  const originMode = body.originMode === "current" ? "current" : "home";

  try {
    // Profile is always the *current* user's own row (RLS + explicit eq).
    const { data: profileRow } = await supabase
      .from("profiles")
      .select(
        "display_name, child_name, child_age_months, child_interests, child_activity_preferences, family_budget_note, preferred_categories, preferred_place_types, indoor_preference, max_distance_miles, nap_start, nap_end, home_lat, home_lng",
      )
      .eq("id", user.id)
      .maybeSingle();

    const profile = toProfile(profileRow as Record<string, unknown> | null);
    const childName = typeof profileRow?.child_name === "string" && profileRow.child_name.trim() ? profileRow.child_name.trim() : null;

    // Resolve origin. "current" is only honored with valid client coords;
    // otherwise we fall back to the saved home location.
    let origin: { lat: number; lng: number } | null = profile.homeLat != null && profile.homeLng != null ? { lat: profile.homeLat, lng: profile.homeLng } : null;
    if (originMode === "current") {
      const o = body.origin as Record<string, unknown> | undefined;
      if (o && typeof o.lat === "number" && typeof o.lng === "number" && Number.isFinite(o.lat) && Number.isFinite(o.lng)) {
        origin = { lat: o.lat, lng: o.lng };
      }
    }

    // Deterministic intent → constraints, then overlay the profile's default
    // distance ceiling when the request didn't specify one.
    const constraints = parseIntent(message, previous);
    if (constraints.maxMiles == null && profile.maxDistanceMiles != null) {
      constraints.maxMiles = profile.maxDistanceMiles;
    }

    const now = new Date();
    const requestId = randomUUID();
    const cacheKey = buildCacheKey(user.id, constraints, profile, origin, now);

    // ---- Cache lookup (per-user, RLS-scoped) ----
    const { data: cached } = await supabase
      .from("poppy_recommendation_cache")
      .select("response, expires_at")
      .eq("cache_key", cacheKey)
      .gt("expires_at", now.toISOString())
      .maybeSingle();

    if (cached?.response) {
      const payload = cached.response as RecommendationResult;
      recordAudit(supabase, user.id, constraints, payload.candidates.length, 0, payload.candidates, true);
      return NextResponse.json({ ...payload, requestId, cacheHit: true });
    }

    // ---- Candidate retrieval (server-side, bounded — never the whole DB
    // to the browser). Runs under the user's RLS context. ----
    const windowEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + EVENT_WINDOW_DAYS);
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const [{ data: places }, { data: events }] = await Promise.all([
      supabase.from("places").select("*").eq("active", true).limit(CANDIDATE_POOL),
      supabase
        .from("feed_events")
        .select("*")
        .gte("starts_at", startOfToday.toISOString())
        .lte("starts_at", windowEnd.toISOString())
        .order("starts_at", { ascending: true })
        .limit(CANDIDATE_POOL),
    ]);

    const placeList = (places ?? []) as Place[];
    const eventList = (events ?? []) as FeedEvent[];

    // Weather at the search origin sharpens indoor/outdoor ranking (same
    // source the Today/Explore pages already use).
    let weather: WeatherContext | null = null;
    if (origin) {
      try { weather = await getWeatherContext(origin.lat, origin.lng); } catch { weather = null; }
    }

    const { candidates, droppedCount } = recommend(
      { places: placeList, events: eventList },
      constraints,
      profile,
      origin,
      weather,
      now,
    );

    // ---- Drive-time enrichment for the short list only (bounded). ----
    await enrichDriveTimes(candidates, origin, placeList, eventList);

    // ---- Poppy's conversational line (deterministic; optionally warmer). ----
    let responseText = buildResponseText(candidates, constraints, childName);
    if (candidates.length > 0) {
      const enhanced = await generatePoppyLine({ candidates, constraints, childName, message });
      if (enhanced) responseText = enhanced;
    }

    const result: RecommendationResult = {
      requestId,
      intent: constraints,
      candidates,
      responseText,
      fallbacks: candidates.length === 0 ? buildFallbacks(constraints) : [],
      cacheHit: false,
    };

    // ---- Persist cache + audit (best-effort; failures never break the
    // response). ----
    const expiresAt = new Date(now.getTime() + CACHE_TTL_MINUTES * 60 * 1000).toISOString();
    void supabase
      .from("poppy_recommendation_cache")
      .upsert({ cache_key: cacheKey, user_id: user.id, response: result, created_at: now.toISOString(), expires_at: expiresAt })
      .then(({ error }) => { if (error) console.error("[poppy] cache write failed", error.message); });

    recordAudit(supabase, user.id, constraints, candidates.length, droppedCount, candidates, false);

    return NextResponse.json(result);
  } catch (err) {
    // Never leak SQL/Supabase/model internals to the client.
    console.error("[poppy] recommendation failed", err);
    return NextResponse.json({ error: "Poppy hit a snag while looking for ideas." }, { status: 500 });
  }
}

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

function recordAudit(
  supabase: SupabaseClient,
  userId: string,
  constraints: RecommendationConstraints,
  candidateCount: number,
  filteredOut: number,
  returned: { type: string; id: string; score: number }[],
  cacheHit: boolean,
) {
  void supabase
    .from("poppy_recommendation_audit")
    .insert({
      user_id: userId,
      request: constraints,
      candidate_count: candidateCount,
      filtered_out: filteredOut,
      returned: returned.map((c) => ({ type: c.type, id: c.id, score: c.score })),
      cache_hit: cacheHit,
    })
    .then(({ error }) => { if (error) console.error("[poppy] audit write failed", error.message); });
}

async function enrichDriveTimes(
  candidates: RecommendationResult["candidates"],
  origin: { lat: number; lng: number } | null,
  places: Place[],
  events: FeedEvent[],
) {
  if (!origin || candidates.length === 0) return;
  const provider = getRoutingProvider();
  if (!provider) return;

  const placeById = new Map(places.map((p) => [p.id, p]));
  const eventById = new Map(events.map((e) => [e.id, e]));
  const points: { candidate: (typeof candidates)[number]; lat: number; lng: number }[] = [];
  for (const c of candidates) {
    const src = c.type === "place" ? placeById.get(c.id) : eventById.get(c.id);
    const lat = src?.lat ?? null;
    const lng = src?.lng ?? null;
    if (lat != null && lng != null) points.push({ candidate: c, lat, lng });
  }
  if (points.length === 0) return;

  try {
    const results = await provider.getDriveTimes(origin, points.map((p) => ({ lat: p.lat, lng: p.lng })));
    if (!results) return;
    points.forEach((p, i) => {
      const drive = results[i];
      if (drive?.durationMinutes != null) {
        p.candidate.driveMinutes = Math.round(drive.durationMinutes);
        p.candidate.distanceLabel = `${Math.round(drive.durationMinutes)} min away`;
      }
    });
  } catch {
    // Straight-line labels already in place — leave them.
  }
}
