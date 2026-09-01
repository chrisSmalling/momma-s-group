export type GeocodedAddress = {
  lat: number;
  lng: number;
  label?: string;
  // "address" = resolved to the actual street address. "postal" = the
  // precise address couldn't be found (common for newer residential
  // streets not yet mapped in OpenStreetMap) and this is a ZIP-code
  // centroid instead — still useful for distance ranking, but callers
  // that display a "verified" claim to the user must not do so for this.
  precision: "address" | "postal";
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
  return { lat, lng, label: feature.properties?.label, precision: "address" };
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

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
// Identifies this app per Nominatim's usage policy. Geocoding only runs when
// a member saves a home address — a rare, user-initiated action — so this
// app's volume is well inside Nominatim's ~1 req/sec public-instance limit.
const NOMINATIM_USER_AGENT = "MommasMeetup/1.0 (family activity planning app; home-address geocoding)";

type NominatimResult = { lat: string; lon: string; display_name?: string };

async function fetchNominatimUrl(url: URL, precision: "address" | "postal"): Promise<GeocodedAddress | null> {
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": NOMINATIM_USER_AGENT },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      cache: "no-store",
    });
    if (!response.ok) {
      console.warn("GEOCODING_NOMINATIM_ERROR", response.status);
      return null;
    }
    const results = await response.json() as NominatimResult[];
    const first = results[0];
    if (!first) return null;
    const lat = Number(first.lat);
    const lng = Number(first.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng, label: first.display_name, precision };
  } catch (error) {
    console.warn("GEOCODING_NOMINATIM_REQUEST_FAILED", error instanceof Error ? error.name : "unknown");
    return null;
  }
}

async function fetchNominatim(input: { street: string; city: string; state: string; zip: string }): Promise<GeocodedAddress | null> {
  const url = new URL(NOMINATIM_URL);
  url.searchParams.set("street", input.street);
  url.searchParams.set("city", input.city);
  url.searchParams.set("state", input.state);
  url.searchParams.set("postalcode", input.zip);
  url.searchParams.set("country", "USA");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");
  return fetchNominatimUrl(url, "address");
}

// Precise-address geocoding routinely fails for newer residential streets
// OpenStreetMap hasn't mapped in detail yet. A ZIP-centroid location is a
// coarse but real distance signal — strictly better for ranking than the
// "no coordinates at all" result that used to leave every place tied on
// distance and effectively sorted alphabetically.
async function fetchNominatimPostalCentroid(zip: string): Promise<GeocodedAddress | null> {
  const url = new URL(NOMINATIM_URL);
  url.searchParams.set("postalcode", zip);
  url.searchParams.set("country", "USA");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");
  return fetchNominatimUrl(url, "postal");
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
  if (!input.street || !input.city || !input.state || !input.zip) return null;

  const apiKey = process.env.OPENROUTESERVICE_API_KEY;
  if (apiKey) {
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
    if (fallbackResult) return fallbackResult;
  }

  // Free, keyless fallback — and the only path at all when no ORS key is
  // configured. Geocoding a home address into lat/lng is what makes
  // straight-line distance ranking work at all (see src/lib/distance.ts);
  // it must never be gated behind the same optional paid key that
  // src/lib/routing reserves for actual road-network drive times, or every
  // member without that key silently loses distance-aware ranking on
  // Today and Places with no visible error.
  const nominatimResult = await fetchNominatim(input);
  if (nominatimResult) return nominatimResult;

  const postalResult = await fetchNominatimPostalCentroid(input.zip);
  if (!postalResult) console.warn("GEOCODING_NO_ADDRESS_MATCH");
  return postalResult;
}
