export type GeocodedAddress = {
  lat: number;
  lng: number;
  label?: string;
};

const STRUCTURED_URL = "https://api.heigit.org/pelias/v1/search/structured";
const SEARCH_URL = "https://api.heigit.org/pelias/v1/search";
const REQUEST_TIMEOUT_MS = 8000;

type PeliasResponse = {
  features?: Array<{
    geometry?: { coordinates?: [number, number] };
    properties?: { label?: string; layer?: string };
  }>;
};

function firstAddress(data: PeliasResponse | null): GeocodedAddress | null {
  if (!data) return null;
  const feature = data.features?.find((item) => item.properties?.layer === "address") ?? data.features?.[0];
  const coordinates = feature?.geometry?.coordinates;
  if (!coordinates || coordinates.length < 2) return null;
  const [lng, lat] = coordinates;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng, label: feature.properties?.label };
}

async function fetchPelias(url: URL): Promise<PeliasResponse | null> {
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      cache: "no-store",
    });
    if (!response.ok) {
      console.warn("GEOCODING_PROVIDER_ERROR", response.status);
      return null;
    }
    return await response.json() as PeliasResponse;
  } catch (error) {
    console.warn("GEOCODING_REQUEST_FAILED", error instanceof Error ? error.name : "unknown");
    return null;
  }
}

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

  // Prefer structured Pelias geocoding because the form already gives us
  // distinct address components.
  const structured = new URL(STRUCTURED_URL);
  structured.searchParams.set("api_key", apiKey);
  structured.searchParams.set("address", input.street);
  structured.searchParams.set("locality", input.city);
  structured.searchParams.set("region", input.state);
  structured.searchParams.set("postalcode", input.zip);
  structured.searchParams.set("country", "USA");
  structured.searchParams.set("boundary.country", "USA");
  structured.searchParams.set("layers", "address");
  structured.searchParams.set("size", "1");

  const structuredResult = firstAddress(await fetchPelias(structured));
  if (structuredResult) return structuredResult;

  // Pelias documents structured search as beta. Fall back to its standard
  // search endpoint so a valid postal address can still be resolved if the
  // structured endpoint returns no match or has a provider-side issue.
  const search = new URL(SEARCH_URL);
  search.searchParams.set("api_key", apiKey);
  search.searchParams.set("text", `${input.street}, ${input.city}, ${input.state} ${input.zip}, USA`);
  search.searchParams.set("boundary.country", "USA");
  search.searchParams.set("layers", "address");
  search.searchParams.set("size", "1");

  const fallbackResult = firstAddress(await fetchPelias(search));
  if (!fallbackResult) console.warn("GEOCODING_NO_ADDRESS_MATCH");
  return fallbackResult;
}
