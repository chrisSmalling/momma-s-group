// Cache-key generation (Phase 9). The key incorporates every factor that
// materially changes the result so that (a) two different users never share a
// cache entry and (b) a stale key can't return a result computed under
// different constraints. RLS on poppy_recommendation_cache already scopes rows
// to the owner; embedding the user id here is defense in depth.

import { createHash } from "node:crypto";
import type { PoppyProfile, RecommendationConstraints } from "./types";

function roundCoord(v: number | null): string {
  // ~1km granularity — enough to reuse a cache entry for the same
  // neighborhood without leaking precise location into the key space.
  return v == null ? "-" : v.toFixed(2);
}

export function buildCacheKey(
  userId: string,
  constraints: RecommendationConstraints,
  profile: PoppyProfile,
  origin: { lat: number; lng: number } | null,
  now: Date,
): string {
  const inventoryDay = now.toISOString().slice(0, 10); // events change daily
  const parts = [
    "v2",
    userId,
    constraints.mood,
    constraints.indoor,
    constraints.indoorExplicit ? "x" : "-",
    constraints.budget,
    constraints.maxMiles ?? "-",
    constraints.timeframe,
    constraints.timeOfDay,
    profile.childAgeMonths ?? "-",
    [...profile.childInterests].sort().join("+") || "-",
    [...profile.preferredCategories].sort().join("+") || "-",
    profile.indoorPreference,
    roundCoord(origin?.lat ?? null),
    roundCoord(origin?.lng ?? null),
    inventoryDay,
  ];
  const raw = parts.join("|");
  return createHash("sha256").update(raw).digest("hex").slice(0, 40);
}
