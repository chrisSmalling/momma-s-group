// Grounded response text for the place-activity-search branch. Never
// invents a match: an empty result set gets an honest miss, never a
// reworded version of "here's something else" that could read as a match.
import type { RecommendationCandidate } from "./types";

export function buildPlaceSearchResponseText(
  term: string,
  results: RecommendationCandidate[],
  childName: string | null,
): string {
  if (results.length === 0) {
    return `I don't have any ${term} places on file yet — I'd rather tell you that than guess. Want me to show everyday places nearby instead?`;
  }
  const count = results.length === 1 ? "1 place" : `${results.length} places`;
  const within = results.every((r) => r.driveMinutes != null) ? " within 45 minutes" : "";
  const forWho = childName ? ` for ${childName}` : "";
  return `I found ${count} for ${term}${forWho}${within}. I've noted what I actually know about each — cost, hours, age fit — and left anything I don't know as unknown rather than guessing.`;
}
