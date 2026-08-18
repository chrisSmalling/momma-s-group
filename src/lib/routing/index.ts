import { OpenRouteServiceProvider } from "./openRouteService";
import type { RoutingProvider } from "./types";

export type { RoutingProvider, LatLng, DriveTimeResult } from "./types";

// Single swap point: set ROUTING_PROVIDER to pick a different
// implementation later (e.g. a Google Routes provider) without touching
// any call site. Returns null when no provider is configured/available —
// callers must fall back to straight-line distance (src/lib/distance.ts),
// never break the page over a missing or failing routing call.
export function getRoutingProvider(): RoutingProvider | null {
  const provider = process.env.ROUTING_PROVIDER ?? "openrouteservice";

  if (provider === "openrouteservice") {
    const apiKey = process.env.OPENROUTESERVICE_API_KEY;
    if (!apiKey) return null;
    return new OpenRouteServiceProvider(apiKey);
  }

  return null;
}
