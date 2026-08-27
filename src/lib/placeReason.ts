// A one-line, grounded reason for a place card (Phase 2 handoff) — built
// only from fields the card already displays elsewhere (age fit, distance,
// free cost). Returns null rather than a generic filler when none of them
// apply, matching the "no icon, only affirmative highlights" rule already
// used by PracticalityIcons: a quiet omission, never an invented reason.
export function buildPlaceReason(opts: {
  goodAgeFit: boolean;
  childAgeMonths: number | null | undefined;
  miles: number | null;
  isFree: boolean;
}): string | null {
  const bits: string[] = [];
  if (opts.goodAgeFit && opts.childAgeMonths != null) {
    const years = Math.floor(opts.childAgeMonths / 12);
    bits.push(years >= 1 ? `a good fit for your ${years}-year-old` : "a good fit for your little one");
  }
  if (opts.miles != null && opts.miles <= 10) {
    bits.push(`only ${opts.miles < 10 ? opts.miles.toFixed(1) : Math.round(opts.miles)} miles away`);
  }
  if (opts.isFree) bits.push("free");
  if (bits.length === 0) return null;
  return `${bits[0].charAt(0).toUpperCase()}${bits[0].slice(1)}${bits.length > 1 ? ` — ${bits.slice(1).join(" · ")}` : "."}`;
}
