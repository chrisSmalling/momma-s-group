import { NextResponse } from "next/server";

/**
 * Retired legacy direct event-ingestion endpoint.
 *
 * Communico/discovery ingestion is no longer permitted to write directly to
 * events. The authoritative discovery path is candidate-only ingestion via
 * discover-local-events-v3 followed by shadow evaluation and promotion.
 */
export async function GET() {
  return NextResponse.json(
    {
      ok: false,
      retired: true,
      error:
        "Direct activity ingestion is retired; discovery ingestion is candidate-only through discover-local-events-v3",
    },
    { status: 410 },
  );
}
