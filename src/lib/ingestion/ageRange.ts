// Infers an age range in months from free-text event description, since
// Communico's feed carries no structured age field (confirmed from real
// ingested raw_payload: only SUMMARY, DESCRIPTION, LOCATION, DTSTART,
// DTEND, GEO, UID, STATUS, ORGANIZER). Deliberately conservative — every
// pattern requires an explicit age/year/month cue word, not bare number
// pairs, so things like "Grades 3-5" don't get misread as an age range.
// Where nothing matches, both fields stay null rather than guessed.

export interface AgeRangeMonths {
  minMonths: number | null;
  maxMonths: number | null;
}

// "babies up to 1-year-old", "baby storytime for children up to 2 years"
const BABIES_UP_TO = /bab(?:y|ies)[^.]{0,60}?up to\s*(\d{1,2})[\s-]*year/i;
// "up to age 3", "through age 5"
const UP_TO_AGE = /(?:up to|through)\s*age\s*(\d{1,2})\b/i;
// "3-5 months", "6 to 9 months"
const MONTH_RANGE = /(\d{1,2})\s*(?:-|to|–)\s*(\d{1,2})\s*months?\b/i;
// "ages 3-5", "age 2 to 4" — explicitly NOT matched when followed by
// "months" (that's MONTH_RANGE's job, checked first anyway).
const YEAR_RANGE = /ages?\s*(\d{1,2})\s*(?:-|to|–)\s*(\d{1,2})\s*(?!months?)\b/i;

export function parseAgeRangeMonths(description: string | null): AgeRangeMonths {
  if (!description) return { minMonths: null, maxMonths: null };

  const babiesUpTo = description.match(BABIES_UP_TO);
  if (babiesUpTo) {
    return { minMonths: 0, maxMonths: Number(babiesUpTo[1]) * 12 };
  }

  const monthRange = description.match(MONTH_RANGE);
  if (monthRange) {
    return { minMonths: Number(monthRange[1]), maxMonths: Number(monthRange[2]) };
  }

  const yearRange = description.match(YEAR_RANGE);
  if (yearRange) {
    return { minMonths: Number(yearRange[1]) * 12, maxMonths: Number(yearRange[2]) * 12 };
  }

  const upToAge = description.match(UP_TO_AGE);
  if (upToAge) {
    return { minMonths: 0, maxMonths: Number(upToAge[1]) * 12 };
  }

  return { minMonths: null, maxMonths: null };
}
