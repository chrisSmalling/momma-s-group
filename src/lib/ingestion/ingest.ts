import type { SupabaseClient } from "@supabase/supabase-js";
import type { SourceAdapter } from "./types";

export interface IngestResult {
  fetched: number;
  valid: number;
  invalid: number;
  created: number;
  updated: number;
  cancelled: number;
  errors: string[];
}

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
export async function ingestSource(
  supabase: SupabaseClient,
  sourceId: string,
  adapter: SourceAdapter,
): Promise<IngestResult> {
  const result: IngestResult = {
    fetched: 0,
    valid: 0,
    invalid: 0,
    created: 0,
    updated: 0,
    cancelled: 0,
    errors: [],
  };
  const now = new Date().toISOString();

  let rawItems;
  try {
    rawItems = await adapter.fetch();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await supabase
      .from("activity_sources")
      .update({ last_fetch_at: now, last_fetch_status: "error", last_fetch_error: message })
      .eq("id", sourceId);
    result.errors.push(message);
    return result;
  }

  result.fetched = rawItems.length;

  for (const raw of rawItems) {
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
  }

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

  return result;
}
