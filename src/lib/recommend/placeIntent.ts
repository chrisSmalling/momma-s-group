// Detects "search places by activity" phrasing ("where can I take her for
// gymnastics?") and pulls out the activity term, so the Poppy route can
// branch to the place-search backbone (src/lib/places/search.ts) instead of
// the event/mood recommendation pipeline. Deterministic regex, same style
// as intent.ts — this is the reliable floor, not a model guess.
//
// Deliberately conservative: an ordinary event/mood query ("anything fun
// this weekend", "something free today") must NOT match, or it would get
// hijacked into a place-only search and silently drop events from the
// results. STRONG patterns carry an explicit trigger phrase ("where can I
// ... for", "looking for", "any ... place") and are authoritative: if one
// of them matches at all, whatever it captures (even if that turns out to
// be un-usable filler, e.g. "looking for a place") is the final answer —
// we do NOT fall through to a looser pattern and risk it grabbing a
// different, garbage substring. WEAK patterns (bare "X classes"/"X place")
// have no trigger phrase, so they're only tried when no STRONG pattern
// matched at all.
const FILLER_PREFIX = /^(?:a|an|the|some|any)\s+/i;
const FILLER_SUFFIX = /\s+(?:class(?:es)?|lessons?|places?|spots?|programs?)$/i;
const TRAILING_LOCATION = /\s*(?:near me|near us|nearby|around here|close by|around town)\s*$/i;
const GENERIC_TERM = /^(?:place|places|somewhere|something|anything|activity|activities|class|classes|fun|good|great|nice|cool|awesome|best|something fun|something good|something new)$/i;

const STRONG_PATTERNS: RegExp[] = [
  // "where can I take her for gymnastics", "where could we go for swim lessons"
  /^where (?:can|could|do|should) (?:i|we|you) (?:take (?:her|him|them|us|[a-z]+)|go|find (?:a |an |some )?(?:place|somewhere))?\s*for (.+)$/i,
  // "any gymnastics places", "some swim classes near us", "a music class"
  /^(?:any|a|an|some) (.+?) (?:place|places|spot|spots|class|classes|lesson|lessons|program|programs)(?:\s+(?:near me|near us|nearby|around here|close by))?$/i,
  // "places for gymnastics", "a place for swim lessons"
  /^(?:a |an |the )?(?:place|places|spot|spots)\s+for\s+(.+)$/i,
  // "looking for a gymnastics place", "need swim lessons" — the trailing
  // place/class/lesson word is required, not optional, so a generic
  // "looking for something fun" doesn't match at all here.
  /^(?:looking for|need|want)\s+(?:a |an |some )?(.+?)\s+(?:place|places|class|classes|lesson|lessons|spot|spots|program|programs)$/i,
];

const WEAK_PATTERNS: RegExp[] = [
  // "gymnastics classes", "swim lessons near me"
  /^(.+?)\s+(?:classes|lessons|programs)(?:\s+(?:near me|near us|nearby|around here|close by))?$/i,
  // "gymnastics places near me"
  /^(.+?)\s+(?:place|places|spot|spots)(?:\s+(?:near me|near us|nearby|around here|close by))?$/i,
];

function cleanTerm(raw: string): string | null {
  let term = raw.trim();
  term = term.replace(FILLER_PREFIX, "");
  term = term.replace(TRAILING_LOCATION, "");
  term = term.replace(FILLER_SUFFIX, "");
  term = term.trim();
  // Too short to be a real activity, or a generic word/phrase ("place",
  // "something fun", "good") rather than an actual activity — treat as no
  // match instead of searching for it.
  if (term.length < 2 || GENERIC_TERM.test(term)) return null;
  return term;
}

export function detectPlaceSearchTerm(message: string): string | null {
  const s = (message ?? "").trim().replace(/[?!.]+$/, "");
  if (!s) return null;

  for (const pattern of STRONG_PATTERNS) {
    const match = s.match(pattern);
    if (match?.[1] === undefined) continue;
    // Authoritative: a strong trigger phrase matched, so this is the
    // answer whether or not it cleans up to a usable term.
    return cleanTerm(match[1]);
  }

  for (const pattern of WEAK_PATTERNS) {
    const match = s.match(pattern);
    const captured = match?.[1];
    if (!captured) continue;
    const term = cleanTerm(captured);
    if (term) return term;
  }

  return null;
}
