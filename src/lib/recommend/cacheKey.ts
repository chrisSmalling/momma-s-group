// Cache-key generation. Every result-affecting constraint is included so
// different users/locations/requests cannot accidentally share results.
import { createHash } from "node:crypto";
import type { PoppyProfile, RecommendationConstraints } from "./types";

function roundCoord(v: number | null): string {
  return v == null ? "-" : v.toFixed(2);
}

export function buildCacheKey(
  userId: string,
  constraints: RecommendationConstraints,
  profile: PoppyProfile,
  origin: { lat: number; lng: number } | null,
  now: Date,
): string {
  const inventoryDay = now.toISOString().slice(0, 10);
  const parts = [
    "v3",
    userId,
    constraints.mood,
    constraints.indoor,
    constraints.indoorExplicit ? "x" : "-",
    constraints.budget,
    constraints.maxMiles ?? "-",
    constraints.maxPriceDollars ?? "-",
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
  return createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 40);
}
