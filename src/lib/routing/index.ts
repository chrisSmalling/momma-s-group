import { OpenRouteServiceProvider } from "./openRouteService";
import type { RoutingProvider } from "./types";

export type { RoutingProvider, LatLng, DriveTimeResult } from "./types";

// Routing is intentionally opt-in. Straight-line distance is fast and is the
// safe fallback for feed rendering; a third-party routing request must never
// become a prerequisite for loading Today or Poppy.
export function getRoutingProvider(): RoutingProvider | null {
  const provider = process.env.ROUTING_PROVIDER;

  if (provider === "openrouteservice") {
    const apiKey = process.env.OPENROUTESERVICE_API_KEY;
    if (!apiKey) return null;
    return new OpenRouteServiceProvider(apiKey);
  }

  return null;
}
