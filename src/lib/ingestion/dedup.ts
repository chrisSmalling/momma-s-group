// Mirrors db/schema.sql's normalize_dedup_key() exactly (same pattern as
// src/lib/distance.ts mirroring distance_km()), so ingestion code and the
// SQL function agree on what "the same activity" means without a round
// trip per item.
export function normalizeDedupKey(title: string, venue: string, eventDate: string): string {
  const norm = (s: string) => s.toLowerCase().trim().replace(/\s+/g, " ");
  return `${norm(title)}|${norm(venue)}|${eventDate}`;
}
