// Deterministic natural-language intent parsing.
//
// This is the regex-based interpretation that previously lived in the React
// Explorer component. It has been moved server-side (Phase 2): the prohibition
// is on doing intent parsing / ranking *in the browser*, not on deterministic
// keyword parsing itself. When a GEMINI_API_KEY is configured the route can
// additionally ask the model to interpret intent, but this deterministic
// parser is always the reliable floor and the sole source of hard filters.

import type {
  BudgetPreference,
  IndoorPreference,
  Mood,
  RecommendationConstraints,
  Timeframe,
} from "./types";

function detectMood(s: string): Mood {
  if (/animal|farm|zoo|petting|ranch|wildlife|butterfl/.test(s)) return "animals";
  if (/water|splash|pool|lagoon|swim|cool off|beach/.test(s)) return "water";
  if (/indoor|inside|rain|raining|too hot|ac\b|air conditioning/.test(s)) return "indoor";
  if (/outside|outdoor|park|nature|fresh air|run around|playground/.test(s)) return "outdoor";
  if (/run|energy|active|burn|climb|gym|wiggl/.test(s)) return "active";
  if (/learn|library|story|storytime|museum|science|read/.test(s)) return "learn";
  if (/art|music|craft|create|dance|paint|sing/.test(s)) return "create";
  return "all";
}

function detectBudget(s: string): BudgetPreference {
  if (/free|no money|no cost|don't want to spend|dont want to spend|\$0/.test(s)) return "free";
  if (/cheap|budget|low.?cost|affordable|under \$?\d+|inexpensive/.test(s)) return "budget";
  return "any";
}

function detectMaxMiles(s: string): number | null {
  const m = s.match(/(\d{1,3})\s*(?:miles|mile|mi)\b/);
  if (m) return Number(m[1]);
  // "within 20 minutes" is a drive-time phrase; we don't have live routing at
  // parse time, so treat it as a modest distance ceiling rather than pretend
  // it's exact minutes. ~2.5 miles per minute of local driving is generous.
  const min = s.match(/(\d{1,3})\s*(?:minute|minutes|min|mins)\b/);
  if (min) return Math.max(3, Math.round(Number(min[1]) * 0.6));
  if (/close by|closby|nearby|near me|near us|down the road|around the corner/.test(s)) return 8;
  return null;
}

function detectTimeframe(s: string): Timeframe {
  if (/weekend|saturday|sunday|sat\b|sun\b/.test(s)) return "weekend";
  if (/tomorrow/.test(s)) return "tomorrow";
  if (/today|right now|this morning|this afternoon|tonight|this evening/.test(s)) return "today";
  return "any";
}

function indoorFromMood(mood: Mood, s: string): { indoor: IndoorPreference; explicit: boolean } {
  if (/indoor|inside|too hot|air conditioning|ac\b/.test(s)) return { indoor: "indoor", explicit: true };
  if (/outdoor|outside|fresh air/.test(s)) return { indoor: "outdoor", explicit: true };
  if (mood === "indoor") return { indoor: "indoor", explicit: true };
  if (mood === "outdoor" || mood === "water") return { indoor: "outdoor", explicit: mood === "outdoor" };
  return { indoor: "either", explicit: false };
}

// Follow-ups like "something closer" / "anything cheaper" tighten the prior
// constraints instead of starting over (Phase 13).
function applyFollowUps(
  s: string,
  base: RecommendationConstraints,
): RecommendationConstraints {
  const next = { ...base };
  if (/closer|nearer|too far/.test(s)) {
    const current = next.maxMiles ?? 15;
    next.maxMiles = Math.max(3, Math.round(current * 0.6));
  }
  if (/farther|further|wider|expand|more options|anything nearby/.test(s)) {
    const current = next.maxMiles ?? 15;
    next.maxMiles = Math.min(60, Math.round(current * 1.75));
  }
  if (/cheaper|less expensive|too expensive|lower cost/.test(s)) {
    next.budget = next.budget === "any" ? "budget" : "free";
  }
  return next;
}

const HARD_INDOOR_WORDS = /indoor|inside|outdoor|outside|too hot|air conditioning/;

export function parseIntent(
  message: string,
  previous?: Partial<RecommendationConstraints>,
): RecommendationConstraints {
  const s = (message ?? "").toLowerCase();
  const mood = detectMood(s);
  const { indoor, explicit } = indoorFromMood(mood, s);
  const budget = detectBudget(s);
  const maxMiles = detectMaxMiles(s);
  const timeframe = detectTimeframe(s);

  // Start from any prior constraints (follow-up context), then overlay
  // anything explicitly stated in this message.
  const base: RecommendationConstraints = {
    mood: previous?.mood ?? "all",
    indoor: previous?.indoor ?? "either",
    budget: previous?.budget ?? "any",
    maxMiles: previous?.maxMiles ?? null,
    timeframe: previous?.timeframe ?? "any",
    indoorExplicit: previous?.indoorExplicit ?? false,
  };

  const merged: RecommendationConstraints = {
    mood: mood !== "all" ? mood : base.mood,
    indoor: HARD_INDOOR_WORDS.test(s) || explicit ? indoor : base.indoor,
    budget: budget !== "any" ? budget : base.budget,
    maxMiles: maxMiles ?? base.maxMiles,
    timeframe: timeframe !== "any" ? timeframe : base.timeframe,
    indoorExplicit: explicit || base.indoorExplicit,
  };

  return applyFollowUps(s, merged);
}
