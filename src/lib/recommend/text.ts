// Deterministic Poppy voice. This is the guaranteed floor for the assistant's
// conversational line; the route may replace it with model-generated text when
// a key is configured, but that text is constrained to the same candidate
// facts and can always fall back to this.

import type { RecommendationCandidate, RecommendationConstraints } from "./types";

function moodWord(c: RecommendationConstraints): string | null {
  switch (c.mood) {
    case "indoor": return "indoor";
    case "outdoor": return "outdoor";
    case "water": return "water play";
    case "active": return "energy-burning";
    case "learn": return "learning";
    case "create": return "arts & crafts";
    case "animals": return "animal";
    default: return null;
  }
}

export function buildResponseText(
  candidates: RecommendationCandidate[],
  constraints: RecommendationConstraints,
  childName: string | null,
): string {
  if (candidates.length === 0) {
    return "I'm not finding a great match nearby right now — want me to widen the search or try a different vibe?";
  }
  const n = candidates.length;
  const mood = moodWord(constraints);
  const forWho = childName ? ` for ${childName}` : "";
  const lead = mood
    ? `Looks like you're after something ${mood}${forWho}. `
    : "";
  const count = n === 1 ? "one good option" : `${n} good options`;
  const closeness =
    constraints.maxMiles != null ? " close by" : "";
  return `${lead}I found ${count}${closeness}. Tap any to see details, or ask me to find something closer or cheaper.`;
}
