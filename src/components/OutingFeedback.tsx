"use client";
import { useState } from "react";

type Sentiment = "loved" | "good" | "not_for_us";
export default function OutingFeedback({ eventId, visible }: { eventId: string; visible: boolean }) {
  const [sentiment, setSentiment] = useState<Sentiment | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (!visible) return null;
  async function choose(value: Sentiment) {
    setError(null); setSentiment(value);
    try {
      const res = await fetch("/api/outing-feedback", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ eventId, sentiment: value }) });
      if (!res.ok) throw new Error();
    } catch { setSentiment(null); setError("Couldn’t save that yet. Try again."); }
  }
  return <section className="mt-5 rounded-2xl border border-rose-100 bg-rose-50/60 p-4" aria-label="Tell us how the outing went"><p className="text-sm font-bold text-zinc-900">How did it go?</p><p className="mt-1 text-xs text-zinc-600">A quick answer helps Poppy learn what your family actually enjoys.</p><div className="mt-3 grid grid-cols-3 gap-2"><button type="button" onClick={()=>void choose("loved")} className="min-h-11 rounded-xl border border-zinc-200 bg-white px-2 text-xs font-bold text-zinc-700">{sentiment==="loved"?"✓ ":""}Loved it</button><button type="button" onClick={()=>void choose("good")} className="min-h-11 rounded-xl border border-zinc-200 bg-white px-2 text-xs font-bold text-zinc-700">{sentiment==="good"?"✓ ":""}It was good</button><button type="button" onClick={()=>void choose("not_for_us")} className="min-h-11 rounded-xl border border-zinc-200 bg-white px-2 text-xs font-bold text-zinc-700">{sentiment==="not_for_us"?"✓ ":""}Not for us</button></div>{error&&<p className="mt-2 text-xs text-rose-700">{error}</p>}</section>;
}
