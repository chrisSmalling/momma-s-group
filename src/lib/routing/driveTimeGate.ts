// The one routed drive-time hard gate, shared by every surface that has to
// answer "is this within N minutes of home" (Poppy's event/place
// recommendations, place-activity search). Fails CLOSED: if an origin is
// known but routing can't be reached, nothing is kept rather than silently
// falling back to straight-line distance and calling it a drive time.
import { getRoutingProvider } from "./index";

const DEFAULT_MAX_DRIVE_MINUTES = 45;

export interface DriveTimeGateItem {
  id: string;
  lat: number | null;
  lng: number | null;
}

export interface DriveTimeGateResult<T> {
  kept: T[];
  driveMinutesById: Map<string, number>;
  // false only when an origin was given but routing couldn't be used at
  // all (no provider configured, or the provider call failed) — callers
  // should show an honest "can't verify drive times right now" message,
  // not silently return zero results as if nothing matched.
  available: boolean;
}

export async function applyDriveTimeGate<T extends DriveTimeGateItem>(
  items: T[],
  origin: { lat: number; lng: number } | null,
  maxMinutes: number = DEFAULT_MAX_DRIVE_MINUTES,
): Promise<DriveTimeGateResult<T>> {
  if (!origin) return { kept: items, driveMinutesById: new Map(), available: true };

  const provider = getRoutingProvider();
  if (!provider) return { kept: [], driveMinutesById: new Map(), available: false };

  const points = items
    .map((item) => ({ lat: item.lat, lng: item.lng }))
    .filter((p): p is { lat: number; lng: number } => p.lat != null && p.lng != null);
  if (points.length === 0) return { kept: [], driveMinutesById: new Map(), available: false };

  try {
    const results = await provider.getDriveTimes(origin, points);
    let i = 0;
    const driveMinutesById = new Map<string, number>();
    for (const item of items) {
      if (item.lat == null || item.lng == null) continue;
      const result = results[i++];
      if (typeof result?.durationMinutes !== "number" || !Number.isFinite(result.durationMinutes)) continue;
      driveMinutesById.set(item.id, Math.round(result.durationMinutes));
    }
    return {
      kept: items.filter((item) => {
        const minutes = driveMinutesById.get(item.id);
        return typeof minutes === "number" && minutes <= maxMinutes;
      }),
      driveMinutesById,
      available: true,
    };
  } catch (err) {
    console.error("[driveTimeGate] routed drive-time lookup failed", err);
    return { kept: [], driveMinutesById: new Map(), available: false };
  }
}
