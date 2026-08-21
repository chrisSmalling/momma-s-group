# Phase 3 discovery hardening — 2026-08-21

Production discovery pipeline changes:

- `discover-local-events-v3` now records every invocation in `public.discovery_runs`.
- Discovery source rotation covers both `discovery` and `structured_web` source types.
- Source selection rotates by `last_attempted_at`, then priority/reliability, preventing the same high-priority sources from starving the inventory.
- Worker batch is bounded to five sources per invocation and child event-link crawling is bounded to ten links per source.
- Child pages are fetched concurrently with `Promise.allSettled`; one failed child page does not fail the source.
- Discovery timestamps for date-only source values are normalized through `America/New_York` rather than a hardcoded UTC offset.
- Redirects are followed and non-2xx source responses are recorded as source errors.
- Discovery runs are finalized as `succeeded`, `partial`, or `failed` with aggregate counts.
- A production watchdog marks discovery runs stuck longer than 15 minutes as failed.
- Discovery scheduler runs every three hours, allowing the 426 active discovery/structured-web sources to rotate in roughly eleven days at the current batch size.

Phase 3 freshness publishing gates remain authoritative: `published + keep` requires fresh verification and cannot bypass due/stale/cancelled/completed freshness states.

Production event geo/address backfill was also completed for the current future feed using source-record GEO data and verified venue addresses/place records.
