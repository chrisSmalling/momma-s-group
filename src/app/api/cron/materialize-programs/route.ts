import { NextResponse } from "next/server";

/**
 * Retired legacy HTTP scheduler endpoint.
 *
 * Recurring-program materialization is now owned by pg_cron, which calls
 * public.materialize_programs() directly with the database's scheduler role.
 * Keeping this route retired prevents a second HTTP publishing/scheduling
 * surface from drifting back into production.
 */
export async function GET() {
  return NextResponse.json(
    {
      ok: false,
      retired: true,
      error:
        "Legacy HTTP materialization endpoint is retired; materialize_programs is scheduled by pg_cron",
    },
    { status: 410 },
  );
}
