// Phase 2 (Poppy v2 handoff): "Good options for your family" was a pure
// static distance sort with no persisted history, so it showed the exact
// same places every single day forever. This module scores that
// repetition as a capped penalty (never an exclusion) so a place shown
// several days running gradually loses to a comparable fresh alternative,
// while a genuinely dominant option (e.g. +40 for a perfect age fit) can
// still resist rotation — "relevance stays primary."
export type ExposureState = { lastShownAt: string; consecutiveDays: number };

const PENALTY_PER_CONSECUTIVE_DAY = 10;
export const MAX_EXPOSURE_PENALTY = 30;

function daysBetween(today: string, prior: string): number {
  const msPerDay = 86400000;
  return Math.round((new Date(`${today}T00:00:00Z`).getTime() - new Date(`${prior}T00:00:00Z`).getTime()) / msPerDay);
}

// The streak length as it stood BEFORE today, independent of whether
// today's exposure has already been recorded — so a same-day page reload
// (which re-reads state that already reflects today) scores identically to
// the first load of the day, and today's ranking never shifts mid-day.
function priorStreak(state: ExposureState | null, today: string): number {
  if (!state) return 0;
  const gap = daysBetween(today, state.lastShownAt);
  if (gap <= 0) return Math.max(0, state.consecutiveDays - 1); // already recorded today
  if (gap === 1) return state.consecutiveDays; // shown yesterday, not yet updated for today
  return 0; // rotated out for 2+ days - fully fresh again
}

// today/prior are "YYYY-MM-DD" date keys (the viewer's local date), not
// timestamps - exposure is a once-a-day concept, not a per-request one.
export function exposurePenalty(state: ExposureState | null, today: string): number {
  return Math.min(MAX_EXPOSURE_PENALTY, priorStreak(state, today) * PENALTY_PER_CONSECUTIVE_DAY);
}

export function nextExposureState(state: ExposureState | null, today: string): ExposureState {
  if (!state) return { lastShownAt: today, consecutiveDays: 1 };
  const gap = daysBetween(today, state.lastShownAt);
  if (gap <= 0) return state; // already recorded today - idempotent within the same day
  if (gap === 1) return { lastShownAt: today, consecutiveDays: state.consecutiveDays + 1 };
  return { lastShownAt: today, consecutiveDays: 1 };
}
