import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Toddler-appropriateness gate. The ONLY thing allowed to set
// places.llm_verification_status (see apply_place_toddler_gate in
// 20260830120000_place_toddler_appropriateness_gate.sql) -- classify-places
// only extracts facility amenities now, it no longer decides eligibility.
//
// Deterministic hard-reject rules (place_hard_reject_reason, free, no LLM
// call) already ran once as part of that migration and re-run here on every
// batch before any Gemini call, so obvious adult-oriented venues never cost
// an LLM call. Everything else goes through Gemini for the ambiguous
// middle, evidence-quote gated exactly like classify-places already proves
// facts: a verdict without a literal supporting quote from the place's own
// description is never trusted (apply_place_toddler_gate enforces this
// server-side too, not just here -- this function cannot bypass that even
// if it wanted to).

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const MODEL = Deno.env.get("GEMINI_MODEL") ?? "gemini-3.5-flash-lite";
const URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
const PLACES_PER_RUN = 100;
const BATCH_SIZE = 5;
const BATCH_DELAY_MS = 1200;

const SYSTEM = `You are checking whether a place is appropriate to bring a toddler (roughly ages 1-4). Using ONLY the supplied name/description/category_tags/place_type, decide a verdict for each place:
- "verified": the evidence clearly supports this being an appropriate place for a toddler (explicit family/kids programming, age-appropriate amenities or activities, a venue type that is inherently toddler-friendly like a playground or children's museum).
- "rejected": the evidence indicates an adult-oriented venue, a venue type incompatible with toddlers, or an explicit age restriction.
- "needs_review": the evidence is ambiguous, insufficient, or you are not confident either way. NEVER guess -- if you are not sure, use needs_review.
Require an exact quote copied verbatim from the supplied description for verdict_quote (for "verified" or "rejected" -- omit/null it for "needs_review" if there is nothing to quote). If you can determine an age range from an explicit age policy in the description, also give age_min_months/age_max_months with an exact supporting quote in age_quote; otherwise leave those null. Do not infer an age range from the venue category alone -- only from an explicit stated policy.
Return ONLY a JSON array: [{"id":"<id>","verdict":"verified"|"needs_review"|"rejected","verdict_quote":"quote"|null,"age_min_months":number|null,"age_max_months":number|null,"age_quote":"quote"|null,"reasoning":"one short sentence"}]`;

interface Row { id: string; name: string; description: string | null; category_tags: string[] | null; place_type: string | null }
interface Verdict {
  id: string;
  verdict?: unknown;
  verdict_quote?: unknown;
  age_min_months?: unknown;
  age_max_months?: unknown;
  age_quote?: unknown;
  reasoning?: unknown;
}

const str = (x: unknown): string | null => (typeof x === "string" && x.trim() ? x.trim().slice(0, 500) : null);
const int = (x: unknown): number | null => (typeof x === "number" && Number.isFinite(x) ? Math.round(x) : null);
const verdictOf = (x: unknown): "verified" | "needs_review" | "rejected" =>
  x === "verified" || x === "rejected" ? x : "needs_review";

async function key(): Promise<string> {
  const { data, error } = await db.rpc("get_gemini_key");
  if (error || typeof data !== "string" || !data) throw new Error("gemini_key lookup failed");
  return data;
}

async function gemini(rows: Row[], k: string): Promise<Map<string, Verdict>> {
  const payload = rows.map((r) => ({
    id: r.id,
    name: r.name ?? "",
    description: (r.description ?? "").slice(0, 2000),
    category_tags: r.category_tags ?? [],
    place_type: r.place_type ?? null,
  }));
  const res = await fetch(URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": k },
    body: JSON.stringify({
      contents: [{ parts: [{ text: `${SYSTEM}\nPLACES:\n${JSON.stringify(payload)}` }] }],
      generationConfig: { temperature: 0, responseMimeType: "application/json", thinkingConfig: { thinkingLevel: "minimal" } },
    }),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const json = await res.json();
  const text = json?.candidates?.[0]?.content?.parts?.[0]?.text ?? "[]";
  const parsed = JSON.parse(text);
  const m = new Map<string, Verdict>();
  for (const x of Array.isArray(parsed) ? parsed : []) if (x?.id) m.set(String(x.id), x);
  return m;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return Response.json({ error: "POST required" }, { status: 405 });
  const secret = req.headers.get("x-cron-secret");
  if (!secret) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { data: validSecret } = await db.rpc("validate_community_cron_secret", { provided_secret: secret });
  if (validSecret !== true) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let k: string;
  try {
    k = await key();
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }

  const { data: queueData, error: queueError } = await db.rpc("get_places_for_toddler_gate", { p_limit: PLACES_PER_RUN });
  if (queueError) return Response.json({ error: queueError.message }, { status: 500 });
  let queue = (queueData ?? []) as Row[];

  // Hard-reject pass against this run's actual backlog (real predicate,
  // via RPC -- see place_hard_reject_reason).
  let hardRejected = 0;
  const remaining: Row[] = [];
  for (const r of queue) {
    const { data: reason, error: reasonError } = await db.rpc("place_hard_reject_reason", {
      p_name: r.name,
      p_description: r.description,
      p_category_tags: r.category_tags,
    });
    if (reasonError) { remaining.push(r); continue; }
    if (reason) {
      const { error: applyError } = await db.rpc("apply_place_toddler_gate", {
        p_place_id: r.id,
        p_verdict: "rejected",
        p_age_min_months: null,
        p_age_max_months: null,
        p_verdict_quote: r.name,
        p_age_quote: null,
        p_reasoning: reason,
        p_model: "hard-rule-v1",
      });
      if (!applyError) { hardRejected++; continue; }
    }
    remaining.push(r);
  }
  queue = remaining;

  let verified = 0, rejected = 0, needsReview = 0, geminiFailedBatches = 0, missingVerdicts = 0, writeFailures = 0;
  let lastError = "";

  for (let i = 0; i < queue.length; i += BATCH_SIZE) {
    const batch = queue.slice(i, i + BATCH_SIZE);
    let verdicts: Map<string, Verdict>;
    try {
      verdicts = await gemini(batch, k);
    } catch (e) {
      geminiFailedBatches++;
      lastError = String(e instanceof Error ? e.message : e).slice(0, 400);
      continue;
    }
    for (const r of batch) {
      const v = verdicts.get(r.id);
      if (!v) { missingVerdicts++; continue; }
      try {
        const { data: finalVerdict, error } = await db.rpc("apply_place_toddler_gate", {
          p_place_id: r.id,
          p_verdict: verdictOf(v.verdict),
          p_age_min_months: int(v.age_min_months),
          p_age_max_months: int(v.age_max_months),
          p_verdict_quote: str(v.verdict_quote),
          p_age_quote: str(v.age_quote),
          p_reasoning: str(v.reasoning) ?? "",
          p_model: MODEL,
        });
        if (error) throw error;
        if (finalVerdict === "verified") verified++;
        else if (finalVerdict === "rejected") rejected++;
        else needsReview++;
      } catch (e) {
        writeFailures++;
        lastError = String(e instanceof Error ? e.message : e).slice(0, 400);
      }
    }
    if (i + BATCH_SIZE < queue.length) await new Promise((r) => setTimeout(r, BATCH_DELAY_MS));
  }

  return Response.json({
    ok: true,
    model: MODEL,
    queue_pulled: queue.length + hardRejected,
    hard_rejected: hardRejected,
    llm_verified: verified,
    llm_rejected: rejected,
    needs_review: needsReview,
    gemini_failed_batches: geminiFailedBatches,
    missing_verdicts: missingVerdicts,
    write_failures: writeFailures,
    last_error: lastError,
  });
});
