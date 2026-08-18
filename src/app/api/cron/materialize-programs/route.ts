import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Triggered daily by Vercel Cron (see vercel.json) to keep recurring_programs
// expanded into concrete `events` rows. materialize_programs() itself
// (db/schema.sql) is already idempotent — it upserts on the partial unique
// index uniq_events_source_external via a deterministic
// `prog:<program_id>:<date>` external_id — and DST-safe, converting each
// occurrence's local wall-clock time via `at time zone`, not manual offset
// math. This route is purely the missing scheduling piece; the SQL itself
// isn't touched.
//
// No dedicated user session here (a cron trigger, not a browser request),
// so this uses a plain supabase-js client rather than the cookie-based
// src/lib/supabase/server.ts client. Uses SUPABASE_SERVICE_ROLE_KEY, not
// the anon key: as of v7, EXECUTE on materialize_programs() is revoked
// from anon/authenticated and granted to service_role only, so this route
// is now the only caller that can invoke it at all (the anon key would
// get a permission-denied error). Protected by CRON_SECRET on top of
// that, so the endpoint itself can't be triggered by anyone who finds
// the URL.
const DAYS_AHEAD = 60;

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data, error } = await supabase.rpc("materialize_programs", {
    days_ahead: DAYS_AHEAD,
  });

  if (error) {
    console.error("materialize_programs failed:", error.message);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  console.log(`materialize_programs: upserted ${data} occurrence(s)`);
  return NextResponse.json({ ok: true, occurrences: data });
}
