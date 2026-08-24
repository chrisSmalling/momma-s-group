# Address-based personalized location

## Acceptance criteria

- Members enter a normal street address in Settings; latitude/longitude fields are removed from the UI.
- The entered address is geocoded server-side using the existing OpenRouteService integration.
- The address is the member-facing source of truth. Geocoded coordinates are retained only as an internal routing cache for the existing real-drive-time calculation.
- Invalid/unresolvable addresses are rejected with a clear error and are not saved as the active home location.
- Existing event/place coordinates remain source data for venue location and weather; member location no longer depends on manual coordinate entry.
