import type { RecommendationCandidate } from "./types";

export type MomIntelligenceItem = {
  label: string;
  value: string;
  kind: "verified" | "community" | "unknown";
};

export function buildMomIntelligence(candidate: RecommendationCandidate): MomIntelligenceItem[] {
  const items: MomIntelligenceItem[] = [];
  if (candidate.strollerAccessible === true) items.push({ label: "Stroller", value: "Friendly", kind: "verified" });
  if (candidate.changingTable === true) items.push({ label: "Changing", value: "Available", kind: "verified" });
  if (candidate.nursingFriendly === true) items.push({ label: "Nursing", value: "Friendly", kind: "verified" });
  if (candidate.parkingNotes?.trim()) items.push({ label: "Parking", value: candidate.parkingNotes.trim(), kind: "community" });
  if (candidate.typicalCrowdNote?.trim()) items.push({ label: "Crowds", value: candidate.typicalCrowdNote.trim(), kind: "community" });
  if (candidate.bestTimeNote?.trim()) items.push({ label: "Best time", value: candidate.bestTimeNote.trim(), kind: "community" });
  if (candidate.whatToBring.length) items.push({ label: "Bring", value: candidate.whatToBring.slice(0, 4).join(", "), kind: "community" });
  return items;
}
