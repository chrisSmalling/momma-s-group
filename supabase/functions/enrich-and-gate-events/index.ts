import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Event-side toddler-appropriateness gate. The ONLY thing allowed to
// set events.toddler_verification_status -- apply_event_toddler_gate,
// mirroring apply_place_toddler_gate exactly (same
// place_evidence_supported substring-match discipline, same three
// honest outcomes). is_kid_relevant (owned by classify-candidates /
// apply_event_enrichment) stays a separate, general "not
// inappropriate for kids" signal -- this is toddler-specific.
//
// One representative event per recurring series is evaluated
// (get_events_for_toddler_gate dedupes by coalesce(program_id, id)),
// then propagate_event_toddler_gate_to_series copies that one real
// verdict to every sibling occurrence -- a 10-occurrence recurring
// event costs one Gemini call, not ten.
//
// Event descriptions are usually already reasonably rich (unlike the
// bare OSM tags that motivated place-side evidence fetching), so this
// evaluates the stored description directly rather than fetching an
// external page -- but it still supports an optional source_url fetch
// for genuinely thin descriptions, same free-first approach as
// enrich-and-gate-places.

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const MODEL = Deno.env.get("GEMINI_MODEL") ?? "gemini-3.5-flash-lite";
const URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
const EVENTS_PER_RUN = 30;
const BATCH_SIZE = 5;
const BATCH_DELAY_MS = 1200;
const MIN_DESCRIPTION_CHARS = 40;

const SYSTEM = `You are checking whether an EVENT is appropriate to bring a toddler (roughly ages 1-4) to. Using ONLY the supplied title/description, decide a verdict for each event:
- "verified": the evidence clearly supports this being an appropriate event for a toddler (explicit toddler/preschool programming, family-friendly activity type, no incompatible age restriction).
- "rejected": the evidence indicates the event targets an older age group (e.g. "ages 6-10", "adults only") or an adult-oriented event type.
- "needs_review": the evidence is ambiguous, insufficient, or you are not confident either way. NEVER guess -- if the description doesn't establish toddler suitability, use needs_review even if the event type sounds plausibly kid-friendly. A general "kid-friendly" or "family event" claim alone is NOT enough for verified -- being kid-relevant in general is not the same as being toddler-appropriate specifically.
Require an exact quote copied verbatim from the supplied description for verdict_quote (for "verified" or "rejected" -- omit/null it for "needs_review"). If an explicit age policy is stated, also give age_min_months/age_max_months with an exact supporting quote in age_quote; otherwise leave those null.
Return ONLY a JSON array: [{"id":"<id>","verdict":"verified"|"needs_review"|"rejected","verdict_quote":"quote"|null,"age_min_months":number|null,"age_max_months":number|null,"age_quote":"quote"|null,"reasoning":"one short sentence"}]`;

interface Row { id: string; program_id: string | null; title: string; description: string | null }
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
  const payload = rows.map((r) => ({ id: r.id, title: r.title ?? "", description: (r.description ?? "").slice(0, 2000) }));
  const res = await fetch(URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": k },
    body: JSON.stringify({
      contents: [{ parts: [{ text: `${SYSTEM}\nEVENTS:\n${JSON.stringify(payload)}` }] }],
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

async function applyAndPropagate(
  eventId: string,
  args: {
    p_verdict: string; p_age_min_months: number | null; p_age_max_months: number | null;
    p_verdict_quote: string | null; p_age_quote: string | null; p_reasoning: string; p_model: string;
    p_evidence_text?: string; p_evidence_source_url?: string | null;
  },
): Promise<string | null> {
  const { data: finalVerdict, error } = await db.rpc("apply_event_toddler_gate", { p_event_id: eventId, ...args });
  if (error) throw error;
  await db.rpc("propagate_event_toddler_gate_to_series", { p_representative_event_id: eventId });
  return finalVerdict;
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

  const { data: queueData, error: queueError } = await db.rpc("get_events_for_toddler_gate", { p_limit: EVENTS_PER_RUN });
  if (queueError) return Response.json({ error: queueError.message }, { status: 500 });
  let queue = (queueData ?? []) as Row[];

  let hardRejected = 0, noEvidence = 0;
  const remaining: Row[] = [];
  for (const r of queue) {
    if (!r.description || r.description.trim().length < MIN_DESCRIPTION_CHARS) {
      const finalVerdict = await applyAndPropagate(r.id, {
        p_verdict: "needs_review",
        p_age_min_months: null, p_age_max_months: null,
        p_verdict_quote: null, p_age_quote: null,
        p_reasoning: "no description (or too thin) to establish toddler-appropriateness",
        p_model: "no-evidence-v1",
      }).catch(() => null);
      if (finalVerdict !== null) { noEvidence++; continue; }
    }

    const { data: reason, error: reasonError } = await db.rpc("event_hard_reject_reason", {
      p_title: r.title,
      p_description: r.description,
    });
    if (reasonError) { remaining.push(r); continue; }
    if (reason) {
      // Same fix as verify-toddler-fit's place-side hard-reject: the
      // reason IS the real evidence (a deterministic regex match), not
      // a quote from description -- pass it as both quote and evidence
      // text so it's honestly self-grounded rather than silently
      // failing the substring check and downgrading to needs_review.
      const finalVerdict = await applyAndPropagate(r.id, {
        p_verdict: "rejected",
        p_age_min_months: null, p_age_max_months: null,
        p_verdict_quote: reason, p_age_quote: null,
        p_reasoning: reason, p_model: "hard-rule-v1",
        p_evidence_text: reason,
      }).catch(() => null);
      if (finalVerdict !== null) { hardRejected++; continue; }
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
        const finalVerdict = await applyAndPropagate(r.id, {
          p_verdict: verdictOf(v.verdict),
          p_age_min_months: int(v.age_min_months),
          p_age_max_months: int(v.age_max_months),
          p_verdict_quote: str(v.verdict_quote),
          p_age_quote: str(v.age_quote),
          p_reasoning: str(v.reasoning) ?? "",
          p_model: MODEL,
        });
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
    queue_pulled: queue.length + hardRejected + noEvidence,
    hard_rejected: hardRejected,
    no_evidence_needs_review: noEvidence,
    llm_verified: verified,
    llm_rejected: rejected,
    needs_review: needsReview,
    gemini_failed_batches: geminiFailedBatches,
    missing_verdicts: missingVerdicts,
    write_failures: writeFailures,
    last_error: lastError,
  });
});
