// Optional, server-only Poppy voice enhancement.
//
// Gemini is used ONLY to phrase the one conversational line more warmly. It is
// given nothing but the already-decided candidate facts (title, why-it-fits,
// distance label, price) plus an optional child first name — never home
// coordinates, ids, or any other profile data (Phase 16). It cannot add,
// remove, or reorder candidates and cannot introduce facts: the structured
// results the UI renders come entirely from the deterministic pipeline. Any
// error, timeout, missing key, or empty result falls back to the deterministic
// line. The name "Gemini" never leaves this file.
//
// NOTE: this path is disabled unless GEMINI_API_KEY is set. It has not been
// exercised against the live model API in this build; it is written to fail
// safe (deterministic fallback) if anything goes wrong.

import type { RecommendationCandidate, RecommendationConstraints } from "./types";

const MODEL = process.env.GEMINI_MODEL ?? "gemini-2.0-flash";
const TIMEOUT_MS = 2500;

interface Args {
  candidates: RecommendationCandidate[];
  constraints: RecommendationConstraints;
  childName: string | null;
  message: string;
}

export async function generatePoppyLine({ candidates, constraints, childName, message }: Args): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || candidates.length === 0) return null;

  // Only structured, already-approved facts cross the boundary.
  const facts = candidates.map((c) => ({
    kind: c.type,
    title: c.title,
    why: c.reason,
    distance: c.distanceLabel,
    price: c.isFree ? "free" : c.price ?? "unknown",
  }));

  const system =
    "You are Poppy, a warm, concise mom-friend inside the Momma's Meetup app. " +
    "Write ONE short, friendly sentence (max ~30 words) introducing the options below. " +
    "You may ONLY reference facts present in the provided list. Do not invent times, prices, " +
    "distances, or places. Do not mention being an AI or any model name. No emojis unless natural.";

  const prompt =
    `${system}\n\nParent asked: ${JSON.stringify(message)}\n` +
    `Child first name: ${childName ?? "unknown"}\n` +
    `Vibe: ${constraints.mood}\n` +
    `Options: ${JSON.stringify(facts)}\n\nPoppy's one-line intro:`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 80 },
      }),
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const data = await res.json();
    const text: unknown = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (typeof text !== "string") return null;
    const line = text.trim().replace(/\s+/g, " ");
    if (!line || line.length > 240) return null;
    return line;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
