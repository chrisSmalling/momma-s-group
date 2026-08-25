// True only when we have a genuine positive match: the viewer's child's age
// is known AND the event/place specifies an age range AND the child falls
// inside it. Unspecified range or unknown child age both return false —
// same "no 'no' icon, only affirmative highlights" rule as
// PracticalityIcons: there's no mismatch callout, only a quiet omission.
export function isGoodAgeFit(
  childAgeMonths: number | null | undefined,
  ageMinMonths: number | null,
  ageMaxMonths: number | null,
): boolean {
  if (childAgeMonths == null) return false;
  if (ageMinMonths == null && ageMaxMonths == null) return false;
  if (ageMinMonths != null && childAgeMonths < ageMinMonths) return false;
  if (ageMaxMonths != null && childAgeMonths > ageMaxMonths) return false;
  return true;
}

function formatMonths(months: number) {
  if (months > 0 && months % 12 === 0) {
    const years = months / 12;
    return `${years} ${years === 1 ? "yr" : "yrs"}`;
  }
  return `${months} mo`;
}

// A single, authoritative age-range label derived from the numeric
// age_min_months/age_max_months bounds — the same bounds isGoodAgeFit
// checks against. Ingested events also carry a separate free-text
// age_tags field from the source scrape, which can disagree with this
// numeric range. Callers should show this label instead of age_tags
// whenever it's available, so only one age signal ever reaches the viewer.
export function formatAgeRange(ageMinMonths: number | null, ageMaxMonths: number | null): string | null {
  if (ageMinMonths == null && ageMaxMonths == null) return null;
  if (ageMinMonths != null && ageMaxMonths != null) {
    if (ageMinMonths === ageMaxMonths) return formatMonths(ageMinMonths);
    return `${formatMonths(ageMinMonths)}–${formatMonths(ageMaxMonths)}`;
  }
  if (ageMinMonths != null) return `${formatMonths(ageMinMonths)}+`;
  return `Up to ${formatMonths(ageMaxMonths as number)}`;
}
