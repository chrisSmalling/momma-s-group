import type { RecommendationCandidate } from "./types";

export type FreshnessState = "verified" | "recent" | "stale" | "unknown";

export interface TrustSummary {
  freshness: FreshnessState;
  freshnessLabel: string;
  knownFactCount: number;
  practicalFactCount: number;
  hasCommunityTips: boolean;
}

function validDate(value: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function getFreshnessState(lastVerifiedAt: string | null, now = new Date()): FreshnessState {
  const verified = validDate(lastVerifiedAt);
  if (!verified) return "unknown";
  const ageHours = Math.max(0, (now.getTime() - verified.getTime()) / 3_600_000);
  if (ageHours < 24) return "verified";
  if (ageHours < 168) return "recent";
  return "stale";
}

export function getFreshnessLabel(state: FreshnessState): string {
  switch (state) {
    case "verified": return "Verified today";
    case "recent": return "Recently verified";
    case "stale": return "May need rechecking";
    case "unknown": return "Verification date unknown";
  }
}

export function getTrustSummary(candidate: RecommendationCandidate, now = new Date()): TrustSummary {
  const known = [
    candidate.description,
    candidate.address,
    candidate.distanceMiles,
    candidate.startsAt,
    candidate.price,
    candidate.ageMinMonths,
    candidate.ageMaxMonths,
    candidate.isOutdoor,
    candidate.registrationRequired,
  ].filter((value) => value !== null && value !== undefined && value !== "").length;

  const practical = [
    candidate.strollerAccessible,
    candidate.changingTable,
    candidate.nursingFriendly,
    candidate.parkingNotes,
    candidate.typicalCrowdNote,
    candidate.bestTimeNote,
    candidate.whatToBring.length > 0 ? candidate.whatToBring : null,
  ].filter((value) => value !== null && value !== undefined && value !== "" && value !== false).length;

  const freshness = getFreshnessState(candidate.lastVerifiedAt, now);
  return {
    freshness,
    freshnessLabel: getFreshnessLabel(freshness),
    knownFactCount: known,
    practicalFactCount: practical,
    hasCommunityTips: (candidate.communityTips ?? []).length > 0,
  };
}

export function buildGroundedWhy(candidate: RecommendationCandidate): string[] {
  const facts: string[] = [];
  if (candidate.goodAgeFit) facts.push("it fits the child age range");
  if (candidate.distanceLabel) facts.push(`it is ${candidate.distanceLabel.replace(/^~/, "").replace(/ away$/, " away")}`);
  if (candidate.isFree) facts.push("it is free");
  if (candidate.isOutdoor === true) facts.push("it is outdoors");
  if (candidate.isOutdoor === false) facts.push("it is indoors");
  if (candidate.registrationRequired) facts.push("registration is required");
  return facts;
}
