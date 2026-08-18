// Mirrors db/schema.sql's distance_km() exactly (same Haversine formula) so
// the app can compute a per-viewer distance from a list of places without a
// round trip per row. This is straight-line "as the crow flies" distance,
// NOT a drive time — there's no routing/traffic data available. Label it
// as approximate distance only; do not phrase it as minutes away.
export function distanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(a));
}

// US audience — display in miles, one decimal under 10mi for a bit of
// precision, whole miles above that.
export function formatDistance(km: number): string {
  const miles = km * 0.621371;
  const rounded = miles < 10 ? miles.toFixed(1) : Math.round(miles).toString();
  return `~${rounded} mi away`;
}
