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
// Unknown is never a pass when we have a specific child to check against:
// if childAgeMonths is known and an item has no age_min_months/
// age_max_months at all, it's excluded -- we can't confirm fit, and we
// don't guess (ticket: "an event whose description establishes toddler
// suitability verifies; a 'kids ages 6-10' event does not surface for
// toddlers", and the events-side acceptance test that hides the 10
// age_min_months>=48 events for a 2-year-old profile -- both go through
// this branch and are unaffected by the change below).
//
// When there's NO known child age (nothing saved on the profile, or a
// browse/directory context with no specific child in play), the
// question is different: is this item plausibly fine for *some* toddler?
// An item with an explicit age range must at least overlap the default
// toddler window [0, DEFAULT_TODDLER_MAX_MONTHS] -- a place starting at
// "ages 5+" still correctly never shows. But an item with NO age range
// data at all is no longer excluded here: verified live 2026-08-31 that
// treating "no item age data" as a hard exclude in the no-profile case
// broke the places directory outright (P1 -- every category chip
// returned zero, since roughly half of all toddler-gate-verified places
// have no separately-extracted numeric age range at all). The toddler-
// appropriateness gate (apply_place_toddler_gate / apply_event_toddler_gate)
// has ALREADY evidence-vetted these items as toddler-appropriate in
// general; a missing supplementary age *range* is not the same claim as
// an unverified item, and withholding it from an anonymous browse when
// nothing else says otherwise was over-applying "unknown is never a
// pass" past what it was meant to prevent (inferring a false age range,
// not staying silent when there's no specific child to fail).
export const DEFAULT_TODDLER_MAX_MONTHS = 48;

export interface AgeGateItem {
  id: string;
  age_min_months: number | null;
  age_max_months: number | null;
}

export function passesAgeGate(
  childAgeMonths: number | null,
  ageMinMonths: number | null,
  ageMaxMonths: number | null,
): boolean {
  if (childAgeMonths != null) {
    if (ageMinMonths == null && ageMaxMonths == null) return false;
    const lo = ageMinMonths ?? 0;
    const hi = ageMaxMonths ?? Number.POSITIVE_INFINITY;
    return childAgeMonths >= lo && childAgeMonths <= hi;
  }
  if (ageMinMonths == null && ageMaxMonths == null) return true;
  const lo = ageMinMonths ?? 0;
  const hi = ageMaxMonths ?? Number.POSITIVE_INFINITY;
  return lo <= DEFAULT_TODDLER_MAX_MONTHS && hi >= 0;
}

export function applyAgeGate<T extends AgeGateItem>(items: T[], childAgeMonths: number | null): T[] {
  return items.filter((item) => passesAgeGate(childAgeMonths, item.age_min_months, item.age_max_months));
}
