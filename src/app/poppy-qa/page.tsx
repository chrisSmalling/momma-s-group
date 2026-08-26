"use client";

import { FormEvent, useState } from "react";

type Candidate = {
  id: string; title: string; address: string | null; distanceMiles: number | null;
  driveMinutes: number | null; startsAt: string | null; price: string | null;
  isFree: boolean; reason: string; href: string;
};

type Result = { responseText: string; candidates: Candidate[]; fallbacks: { label: string }[]; intent: Record<string, unknown>; candidatePool: number };

const prompts = [
  "What can we do today?", "Find something indoors.", "Find something outdoors.",
  "Something cheap.", "Something close.", "What can we do with a 2 year old?", "What's fun this weekend?",
];

export default function PoppyQaPage() {
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e?: FormEvent) {
    e?.preventDefault();
    if (!message.trim() || loading) return;
    setLoading(true); setError(null);
    try {
      const res = await fetch("/api/poppy/qa-recommend", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong while Poppy was looking.");
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong while Poppy was looking.");
    } finally { setLoading(false); }
  }

  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: 20, fontFamily: "system-ui", color: "#172033" }}>
      <p style={{ fontSize: 12, letterSpacing: 1, fontWeight: 700 }}>PREVIEW QA</p>
      <h1 style={{ marginBottom: 6 }}>Poppy</h1>
      <p style={{ marginTop: 0, color: "#64748b" }}>Preview-only acceptance testing. Uses the same recommendation core and production candidate inventory.</p>
      <div style={{ display: "flex", gap: 8, overflowX: "auto", padding: "12px 0" }}>
        {prompts.map((p) => <button key={p} onClick={() => { setMessage(p); void submit(); }} style={{ whiteSpace: "nowrap", border: "1px solid #d7dde7", borderRadius: 999, padding: "9px 12px", background: "white" }}>{p}</button>)}
      </div>
      <form onSubmit={submit} style={{ display: "flex", gap: 8 }}>
        <input value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Ask Poppy…" aria-label="Ask Poppy" style={{ flex: 1, minWidth: 0, padding: 14, border: "1px solid #cbd5e1", borderRadius: 12, fontSize: 16 }} />
        <button disabled={loading || !message.trim()} style={{ padding: "0 18px", border: 0, borderRadius: 12, fontWeight: 700 }}>{loading ? "Looking…" : "Ask"}</button>
      </form>
      {loading && <p aria-live="polite">Poppy is looking around…</p>}
      {error && <p role="alert">{error}</p>}
      {result && <section style={{ marginTop: 20 }} aria-live="polite">
        <p style={{ fontSize: 17, lineHeight: 1.5 }}>{result.responseText}</p>
        <p style={{ fontSize: 12, color: "#64748b" }}>{result.candidates.length} recommendations from {result.candidatePool} verified candidates.</p>
        <div style={{ display: "grid", gap: 12 }}>
          {result.candidates.map((c) => <article key={`${c.id}-${c.href}`} style={{ border: "1px solid #e2e8f0", borderRadius: 16, padding: 16 }}>
            <h2 style={{ fontSize: 17, margin: "0 0 6px" }}>{c.title}</h2>
            <p style={{ margin: "4px 0" }}>{c.address || "Location available"}</p>
            <p style={{ margin: "4px 0", color: "#475569" }}>{c.startsAt ? new Date(c.startsAt).toLocaleString() : "Anytime"} · {c.isFree ? "Free" : (c.price || "See details")} {c.distanceMiles != null ? `· ~${c.distanceMiles.toFixed(1)} mi away` : ""}{c.driveMinutes != null ? ` · ${c.driveMinutes} min drive` : ""}</p>
            <p style={{ margin: "8px 0 0" }}>{c.reason}</p>
            <a href={c.href} style={{ display: "inline-block", marginTop: 10, fontWeight: 700 }}>Open</a>
          </article>)}
        </div>
        {result.candidates.length === 0 && <div style={{ marginTop: 12 }}>{result.fallbacks.map((f) => <button key={f.label} onClick={() => { setMessage(f.label); void submit(); }} style={{ marginRight: 8, marginBottom: 8, padding: "10px 12px", borderRadius: 10, border: "1px solid #cbd5e1", background: "white" }}>{f.label}</button>)}</div>}
      </section>}
    </main>
  );
}
