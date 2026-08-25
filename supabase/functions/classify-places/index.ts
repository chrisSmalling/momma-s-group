import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// classify-places
// Fills facility facts from public place descriptions only.
// Fill-gaps-only and evidence-only: never overwrites existing values.

const db = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const GEMINI_MODEL = Deno.env.get("GEMINI_MODEL") ?? "gemini-3.5-flash-lite";
const GEMINI_URL = (m: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`;
const PLACES_PER_RUN = 100;
const BATCH_SIZE = 8;
const PACE_MS = 4500;

const SYSTEM = `You extract facility facts about a venue from its description, for parents of children aged 0-5. CRITICAL: only assert a fact the description supports. If a facility is not mentioned, return null — do NOT guess. Return false only when the text explicitly says the facility is absent. A wrong "yes" is worse than a null.

Return ONLY a JSON array, one object per input place, in the same order, each:
{
  "id": "<echo the id>",
  "has_changing_table": true | false | null,
  "nursing_friendly": true | false | null,
  "stroller_accessible": true | false | null,
  "quiet_or_sensory_friendly": true | false | null,
  "what_to_bring": ["short item", ...],
  "price_note": "short string" | null,
  "parking_notes": "short string" | null
}
Only return concrete what_to_bring items, price, and parking details explicitly stated in the supplied text.`;

type Row = { id: string; name: string; description: string | null };

function boolOrNull(v: unknown): boolean | null {
  return typeof v === "boolean" ? v : null;
}
function strOrNull(v: unknown): string | null {
  return typeof v === "string" && v.trim() !== "" ? v.trim().slice(0, 300) : null;
}
function strArray(v: unknown): string[] {
  return Array.isArray(v)
    ? v.filter((x) => typeof x === "string" && x.trim() !== "").map((x) => x.trim().slice(0, 60)).slice(0, 12)
    : [];
}

async function getGeminiKey(): Promise<string> {
  const { data, error } = await db.rpc("get_gemini_key");
  if (error) throw new Error(`gemini_key lookup failed: ${error.message}`);
  if (typeof data !== "string" || !data) throw new Error("gemini_key not configured");
  return data;
}

async function geminiBatch(rows: Row[], key: string): Promise<Map<string, any>> {
  const payload = rows.map((r) => ({
    id: r.id,
    name: r.name ?? "",
    description: (r.description ?? "").slice(0, 2000),
  }));
  const res = await fetch(GEMINI_URL(GEMINI_MODEL), {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      contents: [{ parts: [{ text: `${SYSTEM}\n\nPLACES:\n${JSON.stringify(payload)}` }] }],
      generationConfig: {
        temperature: 0,
        responseMimeType: "application/json",
        thinkingConfig: { thinkingLevel: "minimal" },
      },
    }),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`Gemini HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "[]";
  const parsed = JSON.parse(text);
  const out = new Map<string, any>();
  for (const o of Array.isArray(parsed) ? parsed : []) if (o?.id) out.set(String(o.id), o);
  return out;
}

async function writeBack(id: string, v: any): Promise<boolean> {
  const { error } = await db.rpc("apply_place_enrichment", {
    p_place_id: id,
    p_has_changing_table: boolOrNull(v.has_changing_table),
    p_nursing_friendly: boolOrNull(v.nursing_friendly),
    p_stroller_accessible: boolOrNull(v.stroller_accessible),
    p_quiet_or_sensory_friendly: boolOrNull(v.quiet_or_sensory_friendly),
    p_what_to_bring: strArray(v.what_to_bring),
    p_price_note: strOrNull(v.price_note),
    p_parking_notes: strOrNull(v.parking_notes),
    p_model: GEMINI_MODEL,
  });
  return !error;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return Response.json({ error: "POST required" }, { status: 405 });

  const secret = req.headers.get("x-cron-secret");
  if (!secret) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { data: valid } = await db.rpc("validate_community_cron_secret", { provided_secret: secret });
  if (valid !== true) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let key: string;
  try {
    key = await getGeminiKey();
  } catch (e) {
    return Response.json({ error: String(e instanceof Error ? e.message : e) }, { status: 500 });
  }

  const started = Date.now();
  const { data: rows, error } = await db.rpc("get_places_for_enrichment", { p_limit: PLACES_PER_RUN });
  if (error) return Response.json({ error: error.message }, { status: 500 });
  const queue = (rows ?? []) as Row[];

  let enriched = 0;
  let skipped = 0;
  let gemini_failed_batches = 0;
  let missing_verdicts = 0;
  let write_failures = 0;
  let last_gemini_error = "";

  for (let i = 0; i < queue.length; i += BATCH_SIZE) {
    const batch = queue.slice(i, i + BATCH_SIZE);
    let verdicts = new Map<string, any>();
    try {
      verdicts = await geminiBatch(batch, key);
    } catch (e) {
      gemini_failed_batches++;
      skipped += batch.length;
      last_gemini_error = String(e instanceof Error ? e.message : e).slice(0, 400);
      if (i + BATCH_SIZE < queue.length) await new Promise((res) => setTimeout(res, PACE_MS));
      continue;
    }

    for (const r of batch) {
      const v = verdicts.get(r.id);
      if (!v) {
        missing_verdicts++;
        skipped++;
        continue;
      }
      try {
        if (await writeBack(r.id, v)) enriched++;
        else { write_failures++; skipped++; }
      } catch (_e) {
        write_failures++;
        skipped++;
      }
    }

    if (i + BATCH_SIZE < queue.length) await new Promise((res) => setTimeout(res, PACE_MS));
  }

  return Response.json({
    ok: true,
    model: GEMINI_MODEL,
    queue_pulled: queue.length,
    enriched,
    skipped,
    gemini_failed_batches,
    missing_verdicts,
    write_failures,
    last_gemini_error,
    runtime_ms: Date.now() - started,
  });
});