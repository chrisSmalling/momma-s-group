import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { CommunicoSourceAdapter } from "@/lib/ingestion/communico";
import { ingestSource } from "@/lib/ingestion/ingest";
import type { SourceAdapter } from "@/lib/ingestion/types";

// Triggered on a schedule (see vercel.json) to run every active
// activity_sources row through its matching adapter. Dispatch is by
// source_type only — this route never branches on which specific library/
// venue a row is, matching the SourceAdapter contract's whole point: add
// a new vendor by writing a new adapter class + one case here, not by
// special-casing call sites throughout the pipeline.
//
// Same auth shape as materialize-programs: CRON_SECRET bearer token, and
// SUPABASE_SERVICE_ROLE_KEY for the actual writes — activity_sources/
// activity_source_records have zero RLS policies for anon/authenticated
// by design (PR #16), so only the service role can touch them at all.
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data: sources, error: sourcesError } = await supabase
    .from("activity_sources")
    .select("id, name, source_type, base_url, feed_format")
    .eq("active", true);

  if (sourcesError) {
    console.error("failed to list activity_sources:", sourcesError.message);
    return NextResponse.json({ ok: false, error: sourcesError.message }, { status: 500 });
  }

  const results: Record<string, unknown>[] = [];

  for (const source of sources ?? []) {
    let adapter: SourceAdapter | null = null;

    if (source.source_type === "communico") {
      if (!source.base_url || (source.feed_format !== "rss" && source.feed_format !== "ical")) {
        results.push({ source: source.name, skipped: "missing base_url or feed_format" });
        continue;
      }
      adapter = new CommunicoSourceAdapter(source.base_url, source.feed_format);
    }

    if (!adapter) {
      results.push({ source: source.name, skipped: `no adapter for source_type "${source.source_type}"` });
      continue;
    }

    const result = await ingestSource(supabase, source.id, adapter);
    console.log(`ingest ${source.name}:`, JSON.stringify(result));
    results.push({ source: source.name, ...result });
  }

  return NextResponse.json({ ok: true, results });
}
