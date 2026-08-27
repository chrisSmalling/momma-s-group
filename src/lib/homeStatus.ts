// Phase 1.4 (Poppy v2 handoff): distance-dependent pages were gating their
// "add your home address" nudge on coordinates alone, so a saved-but-not-
// yet-geocoded address (state B) looked identical to never having saved
// one at all (state A) — the exact bug behind "Poppy says to add an
// address I already saved." Settings is the single source of truth
// (home_address); coordinates are only the derived geocoding cache.
export type HomeStatus = "missing" | "pending_geocode" | "ready";

export function deriveHomeStatus(
  homeAddress: string | null | undefined,
  homeLat: number | null | undefined,
  homeLng: number | null | undefined,
): HomeStatus {
  if (homeLat != null && homeLng != null) return "ready";
  if (homeAddress?.trim()) return "pending_geocode";
  return "missing";
}
