"use client";
import { useState } from "react";

type Feedback = "helpful" | "not_helpful" | "saved" | "dismissed";
export default function PoppyFeedback({ requestId, candidateId }: { requestId: string; candidateId: string }) {
  const [sent, setSent] = useState<Feedback | null>(null);
  async function send(feedback: Feedback) {
    if (sent) return;
    setSent(feedback);
    try {
      const res = await fetch("/api/poppy/feedback", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ requestId, candidateId, feedback }) });
      if (!res.ok) setSent(null);
    } catch { setSent(null); }
  }
  return (
    <div className="mt-3 flex items-center gap-2" aria-label="Was this recommendation useful?">
      <span className="text-xs font-semibold text-zinc-500">Helpful?</span>
      <button type="button" onClick={() => void send("helpful")} disabled={Boolean(sent)} className="min-h-11 rounded-full border border-zinc-200 bg-white px-3 text-xs font-semibold text-zinc-700 hover:border-emerald-300 hover:text-emerald-700 disabled:opacity-60">{sent === "helpful" ? "✓ Thanks" : "Yes"}</button>
      <button type="button" onClick={() => void send("not_helpful")} disabled={Boolean(sent)} className="min-h-11 rounded-full border border-zinc-200 bg-white px-3 text-xs font-semibold text-zinc-700 hover:border-rose-300 hover:text-rose-700 disabled:opacity-60">{sent === "not_helpful" ? "✓ Got it" : "Not really"}</button>
    </div>
  );
}
