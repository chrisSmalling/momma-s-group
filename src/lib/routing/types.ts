export type LatLng = { lat: number; lng: number };

export type DriveTimeResult = {
  distanceKm: number;
  durationMinutes: number;
};

// A routing provider answers "how far/long from one origin to many
// destinations" in a single batched call. Implementations must never throw
// on a failed/unreachable request — return an empty array (or null per
// destination) so callers can fall back to straight-line distance rather
// than break the page over a missing or failing routing call.
export interface RoutingProvider {
  getDriveTimes(
    origin: LatLng,
    destinations: LatLng[],
  ): Promise<(DriveTimeResult | null)[]>;
}
