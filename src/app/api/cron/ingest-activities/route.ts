import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { CommunicoSourceAdapter } from "@/lib/ingestion/communico";
import { ingestSource } from "@/lib/ingestion/ingest";
import type { SourceAdapter } from "@/lib/ingestion/types";

// Node runtime (not Edge) — the Supabase client and ical/rss parsing both
// need it. maxDuration is set explicitly to this project's actual
// confirmed ceiling: the first live run against both real Communico
// sources in one invocation hit "Vercel Runtime Timeout Error: Task timed
// out after 300 seconds" (visible in that deployment's runtime logs) —
// i.e. 300s is the plan's real limit, not a number to lower. The fix for
// that timeout is NOT a shorter budget; it's processing one source per
// invocation (below) instead of looping over all of them in one request,
// so a single run's realistic worst case (one feed's items) comfortably
// fits well under this ceiling instead of needing all of it.
export const runtime = "nodejs";
export const maxDuration = 300;

// Triggered on a schedule (see vercel.json) to run ONE active
// activity_sources row through its matching adapter per invocation, not
// all of them — see the maxDuration comment above for why. Pass
// ?source=<activity_sources.id> to target a specific row (useful for
// manual testing); otherwise the least-recently-fetched active source is
// picked automatically, so repeated/scheduled invocations rotate through
// every active source over time without any invocation doing more than
// one source's worth of work.
//
// Dispatch is by source_type only — this route never branches on which
// specific library/venue a row is, matching the SourceAdapter contract's
// whole point: add a new vendor by writing a new adapter class + one case
// here, not by special-casing call sites throughout the pipeline.
//
// Same auth shape as materialize-programs (CRON_SECRET bearer token) but
// SUPABASE_SECRET_KEY — Supabase's modern secret API key, not the legacy
// SUPABASE_SERVICE_ROLE_KEY JWT — for the actual writes — activity_sources/
// activity_source_records have zero RLS policies for anon/authenticated by
// design (PR #16), so only this key can touch them at all. NOTE:
// materialize-programs/route.ts (already merged, PR #17) still reads the
// legacy SUPABASE_SERVICE_ROLE_KEY name — flagged as a likely-broken
// production cron, not fixed here, out of this PR's scope.
//
// IMPORTANT: the first real run against Pasco + Hillsborough proved the
// pipeline itself works end to end against real data (fetch, parse,
// dedupe, upsert all completed correctly for 567 real items), but both
// configured sources are RSS feeds, and RSS has no event-start-time
// field. Every item from an RSS-only source lands in
// activity_source_records with resolved_event_id staying null forever —
// zero events are created, and none will be, from RSS alone, no matter
// how well this route runs. That's not a bug in this route; it's the
// adapter correctly refusing to fabricate a start time (see
// communico.ts). Getting real events out of these two sources needs
// their iCal export instead (Communico's feed builder that produced the
// current RSS URLs very likely also offers an iCal option for the same
// filters) — flagged in this PR's description, not solved here.
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
  );

  const requestedSourceId = new URL(request.url).searchParams.get("source");

  const query = supabase
    .from("activity_sources")
    .select("id, name, source_type, base_url, feed_format")
    .eq("active", true);

  const { data: source, error: sourceError } = requestedSourceId
    ? await query.eq("id", requestedSourceId).maybeSingle()
    : await query.order("last_fetch_at", { ascending: true, nullsFirst: true }).limit(1).maybeSingle();

  if (sourceError) {
    console.error("failed to look up activity_sources:", sourceError.message);
    return NextResponse.json({ ok: false, error: sourceError.message }, { status: 500 });
  }

  if (!source) {
    return NextResponse.json({ ok: true, skipped: "no active source found" });
  }

  let adapter: SourceAdapter | null = null;

  if (source.source_type === "communico") {
    if (!source.base_url || (source.feed_format !== "rss" && source.feed_format !== "ical")) {
      return NextResponse.json({ ok: true, source: source.name, skipped: "missing base_url or feed_format" });
    }
    adapter = new CommunicoSourceAdapter(source.base_url, source.feed_format);
  }

  if (!adapter) {
    return NextResponse.json({ ok: true, source: source.name, skipped: `no adapter for source_type "${source.source_type}"` });
  }

  const result = await ingestSource(supabase, source.id, adapter);
  console.log(`ingest ${source.name}:`, JSON.stringify(result));

  return NextResponse.json({ ok: true, source: source.name, sourceId: source.id, ...result });
}
