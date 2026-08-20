import type { SupabaseClient } from "@supabase/supabase-js";
import type { SourceAdapter } from "./types";

export interface IngestResult {
  fetched: number;
  valid: number;
  invalid: number;
  created: number;
  updated: number;
  // Valid items that passed validate() but couldn't be resolved to an
  // event (no existing/cross-source match, and no startsAt to create one
  // with -- e.g. every item from a source whose feed_format is 'rss',
  // since RSS has no event-time field). Tracked separately from
  // created/updated so a "successful" ingest run doesn't read as if it
  // produced real events when it structurally can't have.
  skippedNoStartDate: number;
  cancelled: number;
  errors: string[];
  timingMs: { fetch: number; process: number; total: number };
}

// Per-run cap on raw items processed. A single invocation processes one
// source (see route.ts) with its own duration budget, but a feed could
// still return an unexpectedly large number of items -- this bounds the
// worst case rather than relying on the duration limit alone to fail
// safely. Items beyond the cap are simply left for the next run; nothing
// is lost (activity_source_records.last_seen_at only advances for items
// actually processed this run, so unprocessed items are never marked
// stale/cancelled).
const MAX_ITEMS_PER_RUN = 300;

// Runs one source end to end: fetch -> normalize -> validate ->
// mapToActivity -> dedupe -> write. Deliberately generic over SourceAdapter
// — this function never branches on which adapter it was given.
//
// Dedup, two layers (matching db/schema.sql's design):
//   1. Same-source: activity_source_records' unique (source_id,
//      external_id) — re-seeing the same listing updates it in place.
//   2. Cross-source: dedup_key — if a DIFFERENT source already resolved
//      this same real-world activity, link to that existing event instead
//      of creating a duplicate.
//
// Cancellation/staleness: any source_record for this source not touched
// in this run (because the source stopped listing it) gets its resolved
// event marked cancelled and itself marked 'stale'. If fetch() itself
// throws, this function returns early before reaching that step — a
// single failed fetch never mass-cancels everything from that source.
// Same reasoning applies when MAX_ITEMS_PER_RUN truncates the item list:
// the staleness pass only ever runs after a *complete* fetch, but a
// truncated run would incorrectly mark untouched-this-run items as
// stale, so staleness detection is skipped entirely when truncation
// happened (see `truncated` below).
//
// Resumability: each item's writes (events + activity_source_records)
// commit before the next item starts, so a mid-run failure (timeout,
// crash) leaves whatever was already processed as valid, durable partial
// data rather than nothing. Confirmed for real by the first live run
// against Pasco/Hillsborough: a 300s timeout killed the invocation
// partway through the second source, and both sources' already-processed
// records were intact and correctly marked afterward.
export async function ingestSource(
  supabase: SupabaseClient,
  sourceId: string,
  adapter: SourceAdapter,
): Promise<IngestResult> {
  const runStart = Date.now();
  const result: IngestResult = {
    fetched: 0,
    valid: 0,
    invalid: 0,
    created: 0,
    updated: 0,
    skippedNoStartDate: 0,
    cancelled: 0,
    errors: [],
    timingMs: { fetch: 0, process: 0, total: 0 },
  };
  const now = new Date().toISOString();

  // Marks the run as in-progress before doing any slow work, so a killed
  // invocation is visibly distinguishable in activity_sources from "never
  // run" or "ran and finished" — check last_fetch_status = 'running' with
  // an old last_fetch_at as a stall signal.
  await supabase.from("activity_sources").update({ last_fetch_status: "running" }).eq("id", sourceId);

  let rawItems;
  const fetchStart = Date.now();
  try {
    rawItems = await adapter.fetch();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    result.timingMs.fetch = Date.now() - fetchStart;
    result.timingMs.total = Date.now() - runStart;
    await supabase
      .from("activity_sources")
      .update({ last_fetch_at: now, last_fetch_status: "error", last_fetch_error: message })
      .eq("id", sourceId);
    result.errors.push(message);
    console.log(`[ingest] ${sourceId} fetch failed after ${result.timingMs.fetch}ms: ${message}`);
    return result;
  }
  result.timingMs.fetch = Date.now() - fetchStart;
  result.fetched = rawItems.length;

  const truncated = rawItems.length > MAX_ITEMS_PER_RUN;
  const itemsToProcess = truncated ? rawItems.slice(0, MAX_ITEMS_PER_RUN) : rawItems;
  console.log(
    `[ingest] ${sourceId} fetch done in ${result.timingMs.fetch}ms: ${result.fetched} items` +
      (truncated ? ` (processing first ${MAX_ITEMS_PER_RUN}, rest deferred to next run)` : ""),
  );

  const processStart = Date.now();
  let processed = 0;
  for (const raw of itemsToProcess) {
    const normalized = adapter.normalize(raw);
    const validation = adapter.validate(normalized);
    if (!validation.valid) {
      result.invalid++;
      result.errors.push(`${normalized.title || "(untitled)"}: ${validation.errors.join(", ")}`);
      continue;
    }
    result.valid++;

    const { dedupKey } = adapter.mapToActivity(normalized);

    const { data: existingRecord } = await supabase
      .from("activity_source_records")
      .select("id, resolved_event_id")
      .eq("source_id", sourceId)
      .eq("external_id", normalized.externalId)
      .maybeSingle();

    let resolvedEventId: string | null = existingRecord?.resolved_event_id ?? null;

    if (!resolvedEventId) {
      const { data: matchingRecord } = await supabase
        .from("activity_source_records")
        .select("resolved_event_id")
        .eq("dedup_key", dedupKey)
        .not("resolved_event_id", "is", null)
        .limit(1)
        .maybeSingle();
      resolvedEventId = matchingRecord?.resolved_event_id ?? null;
    }

    // is_kid_relevant is set by calling the DB function, not by
    // reimplementing its keyword logic here — a duplicated TS copy is
    // exactly how this drifted out of sync with the live function once
    // already (a keyword got added to one copy but not the other).
    // Single source of truth in Postgres; ingestion just calls it. Only
    // called when an events write is actually about to happen (skipped
    // for the no-start-date/no-match branch below, which never writes to
    // events at all) — avoids a wasted round trip per item on RSS-only
    // sources, where most items always take that branch.
    let isKidRelevant = false;
    if (resolvedEventId || normalized.startsAt) {
      const { data: kidRelevant, error: kidRelevantError } = await supabase.rpc("is_kid_relevant_event", {
        p_title: normalized.title,
        p_venue_name: normalized.venueName,
        p_source: "communico",
      });
      if (kidRelevantError) {
        result.errors.push(`is_kid_relevant_event RPC failed for ${normalized.title}: ${kidRelevantError.message}`);
      }
      isKidRelevant = kidRelevantError ? false : Boolean(kidRelevant);
    }

    if (resolvedEventId) {
      const { error: updateError } = await supabase
        .from("events")
        .update({
          title: normalized.title,
          description: normalized.description,
          venue_name: normalized.venueName,
          ...(normalized.startsAt ? { starts_at: normalized.startsAt } : {}),
          ends_at: normalized.endsAt,
          source_url: normalized.externalUrl,
          lat: normalized.lat,
          lng: normalized.lng,
          age_min_months: normalized.ageMinMonths,
          age_max_months: normalized.ageMaxMonths,
          is_kid_relevant: isKidRelevant,
          last_verified_at: now,
          status: "published",
        })
        .eq("id", resolvedEventId);
      if (updateError) {
        result.errors.push(`update event failed for ${normalized.title}: ${updateError.message}`);
      } else {
        result.updated++;
      }
    } else if (normalized.startsAt) {
      // Only create a new event once we actually have a start time —
      // events.starts_at is NOT NULL, and a fabricated/guessed time would
      // be worse than not creating the row yet.
      const { data: newEvent, error: insertError } = await supabase
        .from("events")
        .insert({
          title: normalized.title,
          description: normalized.description,
          venue_name: normalized.venueName,
          starts_at: normalized.startsAt,
          ends_at: normalized.endsAt,
          source: "communico",
          source_url: normalized.externalUrl,
          lat: normalized.lat,
          lng: normalized.lng,
          age_min_months: normalized.ageMinMonths,
          age_max_months: normalized.ageMaxMonths,
          is_kid_relevant: isKidRelevant,
          last_verified_at: now,
        })
        .select("id")
        .single();
      if (insertError) {
        result.errors.push(`insert event failed for ${normalized.title}: ${insertError.message}`);
      } else {
        resolvedEventId = newEvent.id;
        result.created++;
      }
    } else {
      // Valid item, but no start time to act on and nothing to link it
      // to yet (e.g. an RSS-only source). Still recorded below so it's
      // deduped against on future runs and against other sources.
      result.skippedNoStartDate++;
    }

    const { error: upsertError } = await supabase.from("activity_source_records").upsert(
      {
        source_id: sourceId,
        external_id: normalized.externalId,
        external_url: normalized.externalUrl,
        raw_payload: normalized.raw,
        dedup_key: dedupKey,
        resolved_event_id: resolvedEventId,
        last_seen_at: now,
      },
      { onConflict: "source_id,external_id" },
    );
    if (upsertError) {
      result.errors.push(`upsert source record failed for ${normalized.title}: ${upsertError.message}`);
    }

    processed++;
    if (processed % 50 === 0) {
      console.log(`[ingest] ${sourceId} processed ${processed}/${itemsToProcess.length} (${Date.now() - processStart}ms elapsed)`);
    }
  }
  result.timingMs.process = Date.now() - processStart;
  console.log(
    `[ingest] ${sourceId} process done in ${result.timingMs.process}ms: ` +
      `valid=${result.valid} invalid=${result.invalid} created=${result.created} ` +
      `updated=${result.updated} skippedNoStartDate=${result.skippedNoStartDate}`,
  );

  // Staleness pass only runs after a complete (non-truncated) fetch —
  // otherwise items beyond MAX_ITEMS_PER_RUN that legitimately still
  // exist on the source would get incorrectly cancelled just because
  // this run didn't reach them.
  if (!truncated) {
    const { data: staleRecords } = await supabase
      .from("activity_source_records")
      .select("id, resolved_event_id")
      .eq("source_id", sourceId)
      .lt("last_seen_at", now)
      .not("resolved_event_id", "is", null);

    for (const stale of staleRecords ?? []) {
      if (!stale.resolved_event_id) continue;
      await supabase
        .from("events")
        .update({ status: "cancelled" })
        .eq("id", stale.resolved_event_id)
        .eq("status", "published");
      await supabase.from("activity_source_records").update({ verification_status: "stale" }).eq("id", stale.id);
      result.cancelled++;
    }
  }

  result.timingMs.total = Date.now() - runStart;
  const status = result.valid === 0 && result.errors.length > 0 ? "error" : result.errors.length > 0 ? "partial" : "success";
  await supabase
    .from("activity_sources")
    .update({
      last_fetch_at: now,
      last_fetch_status: status,
      last_fetch_error: result.errors.length > 0 ? result.errors.slice(0, 5).join("; ") : null,
      ...(result.valid > 0 ? { last_success_at: now } : {}),
    })
    .eq("id", sourceId);

  console.log(`[ingest] ${sourceId} total ${result.timingMs.total}ms status=${status}`);
  return result;
}
