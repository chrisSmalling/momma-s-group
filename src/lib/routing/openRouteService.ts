import type { RoutingProvider, LatLng, DriveTimeResult } from "./types";

const MATRIX_URL = "https://api.openrouteservice.org/v2/matrix/driving-car";
const REQUEST_TIMEOUT_MS = 5000;

// openrouteservice.org's Matrix API: one origin, many destinations, one
// request. Free tier: 2,500 requests/day / 40,000/month, no billing card
// required.
export class OpenRouteServiceProvider implements RoutingProvider {
  constructor(private apiKey: string) {}

  async getDriveTimes(origin: LatLng, destinations: LatLng[]): Promise<(DriveTimeResult | null)[]> {
    if (destinations.length === 0) return [];

    const locations = [[origin.lng, origin.lat], ...destinations.map((d) => [d.lng, d.lat])];
    let response: Response;
    try {
      response = await fetch(MATRIX_URL, {
        method: "POST",
        headers: { Authorization: this.apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({ locations, sources: [0], destinations: destinations.map((_, i) => i + 1), metrics: ["duration", "distance"] }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch {
      return [];
    }

    if (!response.ok) return [];

    let data: { durations?: (number | null)[][]; distances?: (number | null)[][] };
    try { data = await response.json(); } catch { return []; }
    const durations = data.durations?.[0];
    const distances = data.distances?.[0];
    if (!durations || !distances) return [];

    return destinations.map((_, i) => {
      const durationSec = durations[i];
      const distanceM = distances[i];
      if (durationSec == null || distanceM == null) return null;
      return { distanceKm: distanceM / 1000, durationMinutes: durationSec / 60 };
    });
  }
}
