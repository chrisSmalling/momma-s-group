import type { SupabaseClient } from "@supabase/supabase-js";
import type { SourceAdapter } from "./types";

export interface IngestResult {
  fetched: number;
  valid: number;
  invalid: number;
  created: number;
  updated: number;
  skippedNoStartDate: number;
  cancelled: number;
  errors: string[];
  timingMs: { fetch: number; process: number; total: number };
}

const MAX_ITEMS_PER_RUN = 300;

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

  if (!truncated) {
    const { data: staleRecords } = await supabase
      .from("activity_source_records")
      .select("id, resolved_event_id")
      .eq("source_id", sourceId)
      .lt("last_seen_at", now)
      .not("resolved_event_id", "is", null);

    for (const stale of staleRecords ?? []) {
      if (!stale.resolved_event_id) continue;

      const { count: otherSourceCount, error: otherSourceError } = await supabase
        .from("activity_source_records")
        .select("id", { count: "exact", head: true })
        .eq("resolved_event_id", stale.resolved_event_id)
        .neq("source_id", sourceId)
        .neq("verification_status", "stale");

      if (otherSourceError) {
        result.errors.push(`cross-source staleness check failed for ${stale.resolved_event_id}: ${otherSourceError.message}`);
        continue;
      }

      if ((otherSourceCount ?? 0) > 0) {
        await supabase.from("activity_source_records").update({ verification_status: "stale" }).eq("id", stale.id);
        continue;
      }

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
