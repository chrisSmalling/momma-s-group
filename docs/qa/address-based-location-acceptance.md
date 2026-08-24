# Address-based location acceptance

- Home location is entered as a street address, never latitude/longitude.
- Server-side OpenRouteService geocoding resolves the address.
- The stored address is the member-facing source of truth; geocoded coordinates are an internal routing cache.
- Unresolvable addresses are rejected with a clear error.
