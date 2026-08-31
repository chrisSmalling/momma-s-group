import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// The missing middle stage: discovery finds candidates, the toddler
// gate (apply_place_toddler_gate) decides eligibility -- but a bare
// "X is a dance venue" description gives the gate nothing to verify
// against, so real toddler-appropriate places sit stuck in
// needs_review forever. This fetches each candidate's own website
// (free, no paid API) and hands the fetched text to the SAME gate as
// additional evidence -- it never lowers the bar, it gives the bar
// something real to check against. A studio whose site says nothing
// about toddlers still lands in needs_review; one that says "ages 5+"
// still gets rejected. Both are the gate working, not failing.

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const MODEL = Deno.env.get("GEMINI_MODEL") ?? "gemini-3.5-flash-lite";
const URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
const PLACES_PER_RUN = 20;
const FETCH_TIMEOUT_MS = 8000;
const MAX_EVIDENCE_CHARS = 6000;

const SYSTEM = `You are checking whether a place is appropriate to bring a toddler (roughly ages 1-4), using its own description and (when available) text fetched from its own website. Decide a verdict:
- "verified": the evidence clearly supports this being an appropriate place for a toddler (explicit toddler/preschool programming, age-appropriate amenities or activities, or a venue type inherently toddler-friendly).
- "rejected": the evidence indicates an adult-oriented venue, an age policy incompatible with toddlers (e.g. "ages 5+", "adults only"), or a venue type unsuitable for toddlers.
- "needs_review": the evidence is ambiguous, insufficient, or you are not confident either way. NEVER guess -- if the fetched text says nothing about age range or toddler suitability, use needs_review, even if the venue type sounds plausible.
Require an exact quote copied verbatim from the supplied text for verdict_quote (for "verified" or "rejected" -- omit/null it for "needs_review"). The quote may come from EITHER the description OR the fetched website text, whichever actually states it -- copy it exactly as written, do not paraphrase. If an explicit age policy is stated, also give age_min_months/age_max_months with an exact supporting quote in age_quote; otherwise leave those null. Do not infer an age range from the venue category alone.
Return ONLY a JSON object: {"verdict":"verified"|"needs_review"|"rejected","verdict_quote":"quote"|null,"age_min_months":number|null,"age_max_months":number|null,"age_quote":"quote"|null,"reasoning":"one short sentence"}`;

interface Candidate { id: string; name: string; description: string | null; website: string | null; source_url: string | null }
interface Verdict {
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

// Plain regex-based HTML-to-text: no DOM parser dependency, good enough
// to pull readable prose out of a small business's marketing page.
function htmlToText(html: string): string {
  const withoutNoise = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");
  const withoutTags = withoutNoise.replace(/<[^>]+>/g, " ");
  const decoded = withoutTags
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;/gi, "'");
  return decoded.replace(/\s+/g, " ").trim().slice(0, MAX_EVIDENCE_CHARS);
}

async function fetchPageText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "mommas-meetup-evidence-enrichment/1.0", "Accept": "text/html" },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      redirect: "follow",
    });
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html") && !contentType.includes("text")) return null;
    const html = await res.text();
    const text = htmlToText(html);
    return text.length >= 20 ? text : null;
  } catch {
    return null;
  }
}

async function gemini(name: string, description: string | null, evidenceText: string, k: string): Promise<Verdict | null> {
  const payload = { name, description: description ?? "", fetched_text: evidenceText };
  const res = await fetch(URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": k },
    body: JSON.stringify({
      contents: [{ parts: [{ text: `${SYSTEM}\nPLACE:\n${JSON.stringify(payload)}` }] }],
      generationConfig: { temperature: 0, responseMimeType: "application/json", thinkingConfig: { thinkingLevel: "minimal" } },
    }),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const json = await res.json();
  const text = json?.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
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

  const { data: queueData, error: queueError } = await db.rpc("get_places_for_evidence_enrichment", { p_limit: PLACES_PER_RUN });
  if (queueError) return Response.json({ error: queueError.message }, { status: 500 });
  const queue = (queueData ?? []) as Candidate[];

  let fetchOk = 0, fetchFailed = 0, noUrl = 0, geminiFailed = 0, verified = 0, needsReview = 0, rejected = 0, writeFailures = 0;
  let lastError = "";

  for (const c of queue) {
    // Prefer the place's own site; source_url on OSM rows is just the
    // OSM node's metadata page, not the business's own content.
    const fetchUrl = c.website?.trim() || (c.source_url && !c.source_url.includes("openstreetmap.org") ? c.source_url : null);
    if (!fetchUrl) { noUrl++; continue; }

    const evidenceText = await fetchPageText(fetchUrl);
    await db.rpc("mark_place_evidence_fetch_attempted", {
      p_place_id: c.id,
      p_source_url: fetchUrl,
      p_fetch_ok: evidenceText !== null,
    });

    if (!evidenceText) { fetchFailed++; continue; }
    fetchOk++;

    let v: Verdict | null;
    try {
      v = await gemini(c.name, c.description, evidenceText, k);
    } catch (e) {
      geminiFailed++;
      lastError = String(e instanceof Error ? e.message : e).slice(0, 400);
      continue;
    }
    if (!v) { geminiFailed++; continue; }

    try {
      const { data: finalVerdict, error } = await db.rpc("apply_place_toddler_gate", {
        p_place_id: c.id,
        p_verdict: verdictOf(v.verdict),
        p_age_min_months: int(v.age_min_months),
        p_age_max_months: int(v.age_max_months),
        p_verdict_quote: str(v.verdict_quote),
        p_age_quote: str(v.age_quote),
        p_reasoning: str(v.reasoning) ?? "",
        p_model: MODEL,
        p_evidence_text: evidenceText,
        p_evidence_source_url: fetchUrl,
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

  return Response.json({
    ok: true,
    model: MODEL,
    queue_pulled: queue.length,
    no_fetchable_url: noUrl,
    fetch_ok: fetchOk,
    fetch_failed: fetchFailed,
    gemini_failed: geminiFailed,
    write_failures: writeFailures,
    verified,
    needs_review: needsReview,
    rejected,
    last_error: lastError,
  });
});
