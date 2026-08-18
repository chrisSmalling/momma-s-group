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
