import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// classify-candidates
// -------------------
// One structured-extraction pass over discovered events. Fills the exact
// signals the mom-facing Today ranking already reads (age, experience_type,
// indoor/outdoor, weather_fit) so a discovered event ranks as well as a hand-
// curated one. Uses Gemini's free tier; falls back to the existing keyword
// classifier on any failure so the pipeline never blocks.
//
// HARD RULE: only public event text (title/description/venue) is ever sent to
// Google. Nothing from `profiles` — no home address, child age, or PII.

const db = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

// gemini_key lives in the Postgres Vault, not as an Edge Function env var —
// same lookup the sibling classify-places function uses. Fetched fresh per
// invocation via a SECURITY DEFINER RPC rather than Deno.env.get().
async function getGeminiKey(): Promise<string> {
  const { data, error } = await db.rpc("get_gemini_key");
  if (error) throw new Error(`gemini_key lookup failed: ${error.message}`);
  if (typeof data !== "string" || !data) throw new Error("gemini_key not configured");
  return data;
}
const GEMINI_MODEL = Deno.env.get("GEMINI_MODEL") ?? "gemini-2.5-flash-lite";
const GEMINI_URL = (m: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`;

// Per-invocation ceiling. 200 events = ~20 Gemini calls, far under the
// 1,500/day free-tier limit even if this runs hourly.
const EVENTS_PER_RUN = 200;
const BATCH_SIZE = 10;           // events per Gemini call
const PACE_MS = 4500;            // ~13 calls/min, safely under the RPM ceiling

// Vocabularies must match todayEventScore() in src/app/(app)/today/page.tsx.
const EXPERIENCE_TYPES = [
  "community_helper", "animal", "vehicle", "storytime_experience",
  "sensory", "hands_on", "music_movement", "general",
];
const WEATHER_FITS = ["indoor", "outdoor", "water", "any"];
const AGE_BANDS = ["baby", "toddler", "preschool", "family_0_5", "review", "exclude"];

const SYSTEM = `You classify local family/kids event listings for an app used by
parents of children aged 0-5 in the Tampa Bay area. For each event you receive,
return a structured judgment. Be decisive but honest: if the text does not
support a field, use the neutral default rather than guessing.

Return ONLY a JSON array, one object per input event, in the same order, each:
{
  "id": "<echo the id>",
  "is_kid_relevant": boolean,          // true only if suitable for kids 0-5 or their families
  "age_band": one of ${JSON.stringify(AGE_BANDS)},
  "age_min_months": integer or null,
  "age_max_months": integer or null,
  "experience_type": one of ${JSON.stringify(EXPERIENCE_TYPES)},
  "is_outdoor": boolean,               // true only on clear outdoor signal
  "weather_fit": one of ${JSON.stringify(WEATHER_FITS)},  // "water" = splash/pool; "any" if unaffected
  "confidence": integer 0-100,         // your confidence in is_kid_relevant + age_band
  "reason": "short phrase, <120 chars"
}
Adult-only, teen, 18+/21+, and senior programming is NOT kid-relevant
(is_kid_relevant=false, age_band="exclude"). Do not invent facilities or ages.`;

type Row = {
  id: string; title: string; description: string | null;
  venue_name: string | null; source: string;
  age_min_months: number | null; age_max_months: number | null;
};

function coerce(v: unknown, allowed: string[], fallback: string): string {
  return typeof v === "string" && allowed.includes(v) ? v : fallback;
}
function intOrNull(v: unknown): number | null {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? Math.round(n) : null;
}

async function geminiBatch(rows: Row[], key: string): Promise<Map<string, any>> {
  const payload = rows.map((r) => ({
    id: r.id,
    title: r.title ?? "",
    description: (r.description ?? "").slice(0, 1500),
    venue: r.venue_name ?? "",
  }));
  const res = await fetch(GEMINI_URL(GEMINI_MODEL), {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      contents: [{ parts: [{ text: `${SYSTEM}\n\nEVENTS:\n${JSON.stringify(payload)}` }] }],
      generationConfig: { temperature: 0, responseMimeType: "application/json" },
    }),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`Gemini HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "[]";
  const parsed = JSON.parse(text);
  const out = new Map<string, any>();
  for (const o of Array.isArray(parsed) ? parsed : []) if (o?.id) out.set(String(o.id), o);
  return out;
}

// Fallback: existing keyword classifier. Sets kid-relevance only; other fields
// left untouched so a later successful LLM run can fill them.
async function keywordFallback(r: Row) {
  const { data } = await db.rpc("is_kid_relevant_event", {
    p_title: r.title, p_venue_name: r.venue_name, p_source: r.source,
  });
  return {
    is_kid_relevant: data === true,
    age_band: data === true ? "review" : "exclude",
    age_min_months: r.age_min_months, age_max_months: r.age_max_months,
    experience_type: null, is_outdoor: null, weather_fit: null,
    confidence: 30, reason: "keyword fallback (LLM unavailable)", model: "keyword_fallback",
  };
}

async function writeBack(id: string, v: any, model: string) {
  const { error } = await db.rpc("apply_event_enrichment", {
    p_event_id: id,
    p_is_kid_relevant: v.is_kid_relevant === true,
    p_age_band: coerce(v.age_band, AGE_BANDS, "review"),
    p_age_min_months: intOrNull(v.age_min_months),
    p_age_max_months: intOrNull(v.age_max_months),
    p_experience_type: v.experience_type == null ? null : coerce(v.experience_type, EXPERIENCE_TYPES, "general"),
    p_is_outdoor: typeof v.is_outdoor === "boolean" ? v.is_outdoor : null,
    p_weather_fit: v.weather_fit == null ? null : coerce(v.weather_fit, WEATHER_FITS, "any"),
    p_confidence: intOrNull(v.confidence) ?? 0,
    p_reason: String(v.reason ?? "llm enrichment").slice(0, 480),
    p_model: model,
  });
  if (error) throw new Error(`write-back ${id}: ${error.message}`);
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return Response.json({ error: "POST required" }, { status: 405 });

  // Auth mirrors discover-local-events-v3: shared cron secret, validated in-DB.
  const secret = req.headers.get("x-cron-secret");
  if (!secret) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { data: valid } = await db.rpc("validate_community_cron_secret", { provided_secret: secret });
  if (valid !== true) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let geminiKey: string;
  try {
    geminiKey = await getGeminiKey();
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "gemini_key not configured" }, { status: 500 });
  }

  const started = Date.now();
  const { data: rows, error } = await db.rpc("get_events_for_enrichment", { p_limit: EVENTS_PER_RUN });
  if (error) return Response.json({ error: error.message }, { status: 500 });
  const queue = (rows ?? []) as Row[];

  let enriched = 0, fell_back = 0, failed = 0;
  for (let i = 0; i < queue.length; i += BATCH_SIZE) {
    const batch = queue.slice(i, i + BATCH_SIZE);
    try {
      const verdicts = await geminiBatch(batch, geminiKey);
      for (const r of batch) {
        const v = verdicts.get(r.id);
        if (v) { await writeBack(r.id, v, GEMINI_MODEL); enriched++; }
        else { await writeBack(r.id, await keywordFallback(r), "keyword_fallback"); fell_back++; }
      }
    } catch (e) {
      // Whole batch failed (rate limit, model gone, timeout): keyword fallback,
      // pipeline keeps moving. These rows get a real LLM pass next run.
      for (const r of batch) {
        try { await writeBack(r.id, await keywordFallback(r), "keyword_fallback"); fell_back++; }
        catch { failed++; }
      }
    }
    if (i + BATCH_SIZE < queue.length) await new Promise((res) => setTimeout(res, PACE_MS));
  }

  return Response.json({
    ok: true, model: GEMINI_MODEL, queue_pulled: queue.length,
    enriched, fell_back, failed, runtime_ms: Date.now() - started,
  });
});
