"use client";

import { useState } from "react";

const intents = [
  ["indoor", "🏠", "Indoor"], ["outdoor", "🌳", "Outside"], ["water", "💦", "Water"],
  ["active", "🤸", "Burn energy"], ["learn", "📚", "Learn"], ["create", "🎨", "Create"], ["animals", "🐾", "Animals"],
] as const;

export default function ExplorerIntentBar() {
  const [text, setText] = useState("");
  const [intent, setIntent] = useState("");
  function find(nextIntent = intent) {
    const params = new URLSearchParams();
    if (text.trim()) params.set("q", text.trim());
    if (nextIntent) params.set("intent", nextIntent);
    window.location.href = `/explore?${params.toString()}`;
  }
  return (
    <section className="rounded-3xl border border-rose-100 bg-gradient-to-br from-rose-50 via-white to-amber-50 p-5 shadow-sm">
      <div className="text-xs font-bold uppercase tracking-[0.16em] text-rose-600">Momma&apos;s Meetup Explorer</div>
      <h2 className="mt-1 font-display text-2xl font-bold tracking-tight text-zinc-950">What do you want to do today?</h2>
      <p className="mt-2 text-sm leading-6 text-zinc-600">Tell me what you need. I&apos;ll narrow it down instead of making you scroll.</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {intents.map(([key, icon, label]) => <button key={key} type="button" onClick={() => { const next = intent === key ? "" : key; setIntent(next); find(next); }} className={`rounded-full border px-3 py-2 text-sm font-semibold ${intent === key ? "border-rose-500 bg-rose-600 text-white" : "border-zinc-200 bg-white text-zinc-700"}`}>{icon} {label}</button>)}
      </div>
      <form onSubmit={e => { e.preventDefault(); find(); }} className="mt-4 flex gap-2">
        <input value={text} onChange={e => setText(e.target.value)} placeholder="“Something free and close for my 2-year-old”" className="min-w-0 flex-1 rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100" />
        <button type="submit" className="rounded-2xl bg-zinc-900 px-4 py-3 text-sm font-bold text-white">Find</button>
      </form>
      <div className="mt-3 flex flex-wrap gap-2 text-xs text-zinc-500"><span>Try “rainy day”</span><span>•</span><span>“we have 2 hours”</span><span>•</span><span>“we&apos;re already out”</span></div>
    </section>
  );
}
