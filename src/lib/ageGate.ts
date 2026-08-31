// The one hard toddler age-appropriateness filter, shared by every
// surface that shows events or places to an end user (search, Poppy
// recommendations, the calendar/events feed, and the places directory)
// -- same "one gate, every surface" pattern as routing/driveTimeGate.ts,
// but for age fit instead of drive time.
//
// This is an EXCLUSION, not a ranking signal. score.ts's ageScore() (and
// isGoodAgeFit in ageFit.ts, used for the UI "good fit" badge) still run
// on whatever survives this gate -- they rank/label, they don't decide
// visibility. This gate decides visibility.
//
// Complementary to, not a replacement for, the toddler-appropriateness
// gate on places (apply_place_toddler_gate) and the is_kid_relevant flag
// on events: those decide "is this plausibly for kids at all"; this
// decides "does THIS child's age fall inside THIS item's stated range."
// A place can be toddler-verified in general and still fail this gate
// for a specific child (or for the no-profile default) if its own age
// range doesn't cover them.
//
// Unknown is never a pass, uniformly on both events and places: an item
// with no age_min_months/age_max_months at all is excluded regardless of
// whether the child's age is known -- verified live 2026-08-31 that
// applying this to places drops ~45 of 120 currently-verified places
// (ones that passed the toddler gate but never had a numeric range
// extracted from evidence); that's the deliberate, accepted cost of "unknown
// is never a pass" rather than a bug to route around. Never infer a
// range to make an item pass.
export const DEFAULT_TODDLER_MAX_MONTHS = 48;

export interface AgeGateItem {
  id: string;
  age_min_months: number | null;
  age_max_months: number | null;
}

// childAgeMonths known: the item passes only if that exact age falls
// inside [age_min_months, age_max_months] (an open-ended bound -- only
// one of the two stated -- is a real fact, not "unknown," and is
// evaluated as such).
//
// childAgeMonths unknown (no saved profile age): fall back to the
// default toddler window [0, DEFAULT_TODDLER_MAX_MONTHS]. The item's OWN
// range must fit entirely inside that window (not merely overlap it) --
// with no specific child to reason about, an open-ended "18mo+" item
// that might extend well past toddlerhood should not show by default;
// that's "unknown is never a pass" applied to the no-profile case too.
export function passesAgeGate(
  childAgeMonths: number | null,
  ageMinMonths: number | null,
  ageMaxMonths: number | null,
): boolean {
  if (ageMinMonths == null && ageMaxMonths == null) return false;
  if (childAgeMonths != null) {
    const lo = ageMinMonths ?? 0;
    const hi = ageMaxMonths ?? Number.POSITIVE_INFINITY;
    return childAgeMonths >= lo && childAgeMonths <= hi;
  }
  const hi = ageMaxMonths ?? Number.POSITIVE_INFINITY;
  return hi <= DEFAULT_TODDLER_MAX_MONTHS;
}

export function applyAgeGate<T extends AgeGateItem>(items: T[], childAgeMonths: number | null): T[] {
  return items.filter((item) => passesAgeGate(childAgeMonths, item.age_min_months, item.age_max_months));
}
