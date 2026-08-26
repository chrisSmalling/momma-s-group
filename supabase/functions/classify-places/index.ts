import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// classify-places
// Public place text only. Gemini proposes facts; the database independently
// validates supporting evidence before any facility fact is accepted.

const db = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const GEMINI_MODEL = Deno.env.get("GEMINI_MODEL") ?? "gemini-3.5-flash-lite";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
const PLACES_PER_RUN = 10; // controlled canary; increase only after QA
const BATCH_SIZE = 5;
const PACE_MS = 3000;

const SYSTEM = `You extract facility facts about a venue from its public description for parents of children aged 0-5.
CRITICAL EVIDENCE RULE: never infer or paraphrase evidence. For every non-null scalar claim, evidence must be copied from the supplied description. If the description does not explicitly support the claim, return null and an empty evidence string.
For what_to_bring, include only concrete items explicitly named in the description and provide an exact evidence quote covering them. For price and parking, only return information explicitly stated and provide exact evidence.
Return ONLY a JSON array, one object per input place, in the same order:
{
  "id": "<echo id>",
  "has_changing_table": true | false | null,
  "nursing_friendly": true | false | null,
  "stroller_accessible": true | false | null,
  "quiet_or_sensory_friendly": true | false | null,
  "what_to_bring": ["short item", ...],
  "price_note": "short string" | null,
  "parking_notes": "short string" | null,
  "evidence": {
    "has_changing_table": "exact quote" | "",
    "nursing_friendly": "exact quote" | "",
    "stroller_accessible": "exact quote" | "",
    "quiet_or_sensory_friendly": "exact quote" | "",
    "what_to_bring": "exact quote" | "",
    "price_note": "exact quote" | "",
    "parking_notes": "exact quote" | ""
  }
}`;

type Row = { id: string; name: string; description: string | null };

type Verdict = {
  id: string;
  has_changing_table?: unknown;
  nursing_friendly?: unknown;
  stroller_accessible?: unknown;
  quiet_or_sensory_friendly?: unknown;
  what_to_bring?: unknown;
  price_note?: unknown;
  parking_notes?: unknown;
  evidence?: Record<string, unknown>;
};

function boolOrNull(v: unknown): boolean | null {
  return typeof v === "boolean" ? v : null;
}
function strOrNull(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim().slice(0, 300) : null;
}
function strArray(v: unknown): string[] {
  return Array.isArray(v)
    ? v.filter((x) => typeof x === "string" && x.trim()).map((x) => x.trim().slice(0, 60)).slice(0, 12)
    : [];
}
function evidence(v: unknown): string {
  return typeof v === "string" ? v.trim().slice(0, 500) : "";
}

async function getGeminiKey(): Promise<string> {
  const { data, error } = await db.rpc("get_gemini_key");
  if (error) throw new Error(`gemini_key lookup failed: ${error.message}`);
  if (typeof data !== "string" || !data) throw new Error("gemini_key not configured");
  return data;
}

async function geminiBatch(rows: Row[], key: string): Promise<Map<string, Verdict>> {
  const payload = rows.map((r) => ({
    id: r.id,
    name: r.name ?? "",
    description: (r.description ?? "").slice(0, 2000),
  }));
  const res = await fetch(GEMINI_URL, {
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
  const out = new Map<string, Verdict>();
  for (const o of Array.isArray(parsed) ? parsed : []) if (o?.id) out.set(String(o.id), o as Verdict);
  return out;
}

async function writeBack(id: string, v: Verdict) {
  const { error } = await db.rpc("apply_place_enrichment_v2", {
    p_place_id: id,
    p_has_changing_table: boolOrNull(v.has_changing_table),
    p_nursing_friendly: boolOrNull(v.nursing_friendly),
    p_stroller_accessible: boolOrNull(v.stroller_accessible),
    p_quiet_or_sensory_friendly: boolOrNull(v.quiet_or_sensory_friendly),
    p_what_to_bring: strArray(v.what_to_bring),
    p_price_note: strOrNull(v.price_note),
    p_parking_notes: strOrNull(v.parking_notes),
    p_evidence: {
      has_changing_table: evidence(v.evidence?.has_changing_table),
      nursing_friendly: evidence(v.evidence?.nursing_friendly),
      stroller_accessible: evidence(v.evidence?.stroller_accessible),
      quiet_or_sensory_friendly: evidence(v.evidence?.quiet_or_sensory_friendly),
      what_to_bring: evidence(v.evidence?.what_to_bring),
      price_note: evidence(v.evidence?.price_note),
      parking_notes: evidence(v.evidence?.parking_notes),
    },
    p_model: GEMINI_MODEL,
  });
  if (error) throw new Error(error.message);
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

  let enriched = 0, skipped = 0, gemini_failed_batches = 0, missing_verdicts = 0, write_failures = 0;
  let last_gemini_error = "";

  for (let i = 0; i < queue.length; i += BATCH_SIZE) {
    const batch = queue.slice(i, i + BATCH_SIZE);
    let verdicts: Map<string, Verdict>;
    try {
      verdicts = await geminiBatch(batch, key);
    } catch (e) {
      gemini_failed_batches++;
      skipped += batch.length;
      last_gemini_error = String(e instanceof Error ? e.message : e).slice(0, 400);
      if (i + BATCH_SIZE < queue.length) await new Promise((r) => setTimeout(r, PACE_MS));
      continue;
    }

    for (const r of batch) {
      const v = verdicts.get(r.id);
      if (!v) { missing_verdicts++; skipped++; continue; }
      try { await writeBack(r.id, v); enriched++; }
      catch (_e) { write_failures++; skipped++; }
    }
    if (i + BATCH_SIZE < queue.length) await new Promise((r) => setTimeout(r, PACE_MS));
  }

  return Response.json({
    ok: true, model: GEMINI_MODEL, queue_pulled: queue.length,
    enriched, skipped, gemini_failed_batches, missing_verdicts, write_failures,
    last_gemini_error, runtime_ms: Date.now() - started,
  });
});