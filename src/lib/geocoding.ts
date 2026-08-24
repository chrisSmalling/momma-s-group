export type GeocodedAddress = {
  lat: number;
  lng: number;
  label?: string;
};

const GEOCODE_URL = "https://api.heigit.org/pelias/v1/search";
const REQUEST_TIMEOUT_MS = 5000;

/**
 * Geocodes a member-entered street address server-side.
 * The address is the source of truth; coordinates are only the representation
 * required by routing. HeiGIT's current Pelias endpoint is used here because
 * api.openrouteservice.org was shut off on August 24, 2026.
 */
export async function geocodeAddress(address: string): Promise<GeocodedAddress | null> {
  const apiKey = process.env.OPENROUTESERVICE_API_KEY;
  const normalized = address.trim();
  if (!apiKey || !normalized) return null;

  const url = new URL(GEOCODE_URL);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("text", normalized);
  url.searchParams.set("size", "1");
  url.searchParams.set("boundary.country", "US");

  try {
    const response = await fetch(url, {
      headers: { Authorization: apiKey },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      next: { revalidate: 86400 },
    });
    if (!response.ok) return null;

    const data = await response.json() as {
      features?: Array<{
        geometry?: { coordinates?: [number, number] };
        properties?: { label?: string };
      }>;
    };
    const feature = data.features?.[0];
    const coordinates = feature?.geometry?.coordinates;
    if (!coordinates || coordinates.length < 2) return null;

    const [lng, lat] = coordinates;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng, label: feature.properties?.label };
  } catch {
    return null;
  }
}
