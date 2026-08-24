export type GeocodedAddress = {
  lat: number;
  lng: number;
  label?: string;
};

const GEOCODE_URL = "https://api.heigit.org/pelias/v1/search/structured";
const REQUEST_TIMEOUT_MS = 8000;

/**
 * Geocodes the structured member-entered address server-side.
 * The address remains the source of truth; coordinates are only the internal
 * representation required by routing.
 */
export async function geocodeAddress(input: {
  street: string;
  city: string;
  state: string;
  zip: string;
}): Promise<GeocodedAddress | null> {
  const apiKey = process.env.OPENROUTESERVICE_API_KEY;
  if (!apiKey || !input.street || !input.city || !input.state || !input.zip) return null;

  const url = new URL(GEOCODE_URL);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("address", input.street);
  url.searchParams.set("locality", input.city);
  url.searchParams.set("region", input.state);
  url.searchParams.set("postalcode", input.zip);
  url.searchParams.set("country", "USA");
  url.searchParams.set("boundary.country", "USA");
  url.searchParams.set("layers", "address");
  url.searchParams.set("size", "1");

  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      next: { revalidate: 86400 },
    });
    if (!response.ok) {
      console.warn("GEOCODING_PROVIDER_ERROR", response.status);
      return null;
    }

    const data = await response.json() as {
      features?: Array<{
        geometry?: { coordinates?: [number, number] };
        properties?: { label?: string };
      }>;
    };
    const feature = data.features?.[0];
    const coordinates = feature?.geometry?.coordinates;
    if (!coordinates || coordinates.length < 2) {
      console.warn("GEOCODING_NO_ADDRESS_MATCH");
      return null;
    }

    const [lng, lat] = coordinates;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng, label: feature.properties?.label };
  } catch (error) {
    console.warn("GEOCODING_REQUEST_FAILED", error instanceof Error ? error.name : "unknown");
    return null;
  }
}
