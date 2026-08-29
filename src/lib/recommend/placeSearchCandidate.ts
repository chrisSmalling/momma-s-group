// Maps a place-search backbone result onto the same RecommendationCandidate
// shape the mood/event pipeline produces, so the Poppy UI (and its
// candidate card, feedback widget, etc.) don't need a separate rendering
// path for this branch.
import { isFreeCost } from "@/lib/cost";
import { buildPlaceReason } from "@/lib/placeReason";
import type { PlaceSearchResult } from "@/lib/places/search";
import type { RecommendationCandidate } from "./types";

function distanceLabel(miles: number | null): string | null {
  if (miles == null) return null;
  return `~${miles < 10 ? miles.toFixed(1) : Math.round(miles)} mi away`;
}

export function toPlaceSearchCandidate(
  result: PlaceSearchResult,
  childAgeMonths: number | null,
  rank: number,
): RecommendationCandidate {
  const { place, miles, driveMinutes, goodAgeFit } = result;
  const isFree = isFreeCost(place.price_note);
  return {
    type: "place",
    id: place.id,
    title: place.name,
    // toddler_notes is the curated summary shown elsewhere on place cards;
    // the raw `description` column is often unedited scraped page text
    // (nav menus, boilerplate) — never surface that directly to a parent.
    description: place.toddler_notes,
    address: place.address,
    distanceMiles: miles,
    driveMinutes,
    distanceLabel: distanceLabel(miles),
    startsAt: null,
    endsAt: null,
    price: place.price_note,
    isFree,
    isOutdoor: place.is_outdoor,
    ageMinMonths: place.age_min_months,
    ageMaxMonths: place.age_max_months,
    goodAgeFit,
    reason: buildPlaceReason({ goodAgeFit, childAgeMonths, miles, isFree }) ?? "An everyday place worth considering.",
    href: `/places/${place.id}/propose`,
    lastVerifiedAt: place.last_verified_at,
    // Not a scored/ranked pipeline — search_places already ordered these;
    // this only exists to give ties a stable, order-preserving sort key.
    score: -rank,
    whatToBring: place.what_to_bring,
    strollerAccessible: place.stroller_accessible,
    changingTable: place.has_changing_table,
    nursingFriendly: place.nursing_friendly,
    parkingNotes: place.parking_notes,
    typicalCrowdNote: place.typical_crowd_note,
    bestTimeNote: place.best_time_note,
    registrationRequired: false,
    communityTips: [],
  };
}
