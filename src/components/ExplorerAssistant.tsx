"use client";

import { useMemo, useState } from "react";
import type { Place } from "@/types";

type Props = { places: Place[]; childAgeMonths: number | null; homeLat: number | null; homeLng: number | null };
type Mood = "all" | "indoor" | "outdoor" | "water" | "active" | "learn" | "create" | "animals";
type Origin = { lat: number; lng: number } | null;

const chips: { mood: Mood; label: string; icon: string }[] = [
  { mood: "outdoor", label: "Outside", icon: "🌳" }, { mood: "indoor", label: "Indoor", icon: "🏠" },
  { mood: "water", label: "Water", icon: "💦" }, { mood: "active", label: "Burn energy", icon: "🤸" },
  { mood: "learn", label: "Learn", icon: "📚" }, { mood: "create", label: "Create", icon: "🎨" },
  { mood: "animals", label: "Animals", icon: "🐾" },
];

function miles(a: Origin, b: { lat: number | null; lng: number | null }) {
  if (!a || b.lat == null || b.lng == null) return null;
  const r = 3958.7613, dLat = ((b.lat - a.lat) * Math.PI) / 180, dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(x));
}
function hay(p: Place) { return `${p.name} ${p.description ?? ""} ${p.toddler_notes ?? ""} ${p.price_note ?? ""}`.toLowerCase(); }
function infer(text: string) {
  const q = text.toLowerCase();
  const mood: Mood = /animal|farm|zoo|petting|ranch|wildlife/.test(q) ? "animals" : /water|splash|pool|swim|lagoon|cool off/.test(q) ? "water" : /indoor|rain|raining|hot|heat|too hot/.test(q) ? "indoor" : /outside|outdoor|park|nature|fresh air/.test(q) ? "outdoor" : /run|energy|active|burn|climb|gym/.test(q) ? "active" : /learn|library|story|museum|science/.test(q) ? "learn" : /art|music|craft|create|dance/.test(q) ? "create" : "all";
  const budget = /free|cheap|low cost|budget|don't want to spend|no money/.test(q);
  const easy = /tired|exhausted|easy|low key|low-key|simple/.test(q);
  const maxMiles = /5\s*(?:mile|mi)|five\s*miles/.test(q) ? 5 : /10\s*(?:mile|mi)|ten\s*miles/.test(q) ? 10 : /20\s*(?:mile|mi)|twenty\s*miles/.test(q) ? 20 : 30;
  return { mood, budget, easy, maxMiles };
}
function matchesMood(p: Place, mood: Mood) {
  if (mood === "all") return true; const t = hay(p);
  if (mood === "indoor") return p.is_outdoor === false || p.is_enclosed === true || /indoor|museum|library|gym|play/.test(t);
  if (mood === "outdoor") return p.is_outdoor === true || /park|playground|nature|trail|farm|zoo|garden/.test(t);
  if (mood === "water") return /splash|water|lagoon|pool|aquatic|swim|spray/.test(t);
  if (mood === "active") return /gym|gymnast|movement|sports|playground|soccer|dance|jump|trampoline/.test(t);
  if (mood === "learn") return /library|museum|science|learning|story|nature|discovery|education/.test(t);
  if (mood === "create") return /art|music|craft|creative|dance|studio|maker/.test(t);
  return /animal|farm|zoo|petting|ranch|wildlife/.test(t);
}
function ageScore(p: Place, age: number | null) {
  if (age == null) return 0; const min = p.age_min_months ?? 0, max = p.age_max_months ?? 144;
  if (age >= min && age <= max) return 40; if (age >= min - 6 && age <= max + 6) return 12; return -30;
}

export default function ExplorerAssistant({ places, childAgeMonths, homeLat, homeLng }: Props) {
  const [prompt, setPrompt] = useState(""); const [mood, setMood] = useState<Mood>("all");
  const [origin, setOrigin] = useState<Origin>(homeLat != null && homeLng != null ? { lat: homeLat, lng: homeLng } : null);
  const [usingCurrent, setUsingCurrent] = useState(false); const [message, setMessage] = useState<string | null>(null); const [planOpen, setPlanOpen] = useState(false);
  const parsed = useMemo(() => infer(prompt), [prompt]); const effectiveMood = mood === "all" ? parsed.mood : mood;
  const results = useMemo(() => places.map((place) => {
    const distance = miles(origin, place); let score = ageScore(place, childAgeMonths);
    if (matchesMood(place, effectiveMood)) score += 35; if (place.toddler_notes) score += 8; if (place.restrooms) score += 3; if (place.stroller_accessible) score += 3; if (place.has_changing_table) score += 4; if (place.quiet_or_sensory_friendly) score += 3;
    if (parsed.budget && /free|\$0|no cost|free entry/.test(hay(place))) score += 15;
    if (parsed.easy && (place.stroller_accessible || place.restrooms || place.is_enclosed)) score += 5;
    if (distance != null) score += Math.max(0, 25 - distance * 1.1);
    return { place, distance, score };
  }).filter(({ distance }) => distance == null || distance <= parsed.maxMiles).sort((a, b) => b.score - a.score).slice(0, 5), [places, childAgeMonths, origin, effectiveMood, parsed]);
  function locate() {
    if (!navigator.geolocation) { setMessage("Location isn't available on this device. I'll use your saved home location instead."); return; }
    setMessage("Finding you…"); navigator.geolocation.getCurrentPosition((p) => { setOrigin({ lat: p.coords.latitude, lng: p.coords.longitude }); setUsingCurrent(true); setMessage("I'm using your current location for this search only — I don't continuously track you."); }, () => setMessage("I couldn't get your location. You can still search from home."), { maximumAge: 300000, timeout: 10000, enableHighAccuracy: false });
  }
  const greeting = childAgeMonths != null ? `I'll keep your ${Math.floor(childAgeMonths / 12)}-year-old in mind.` : "Tell me what you're looking for and I'll narrow it down.";
  return <section className="overflow-hidden rounded-3xl border border-rose-100 bg-gradient-to-br from-rose-50 via-white to-amber-50 shadow-sm">
    <div className="p-5 sm:p-6"><div className="text-xs font-bold uppercase tracking-[0.16em] text-rose-600">Your Momma&apos;s Meetup Explorer</div><h2 className="mt-1 font-display text-2xl font-bold tracking-tight text-zinc-950">Tell me what you need today.</h2><p className="mt-2 text-sm leading-6 text-zinc-600">You don&apos;t have to know the right category. Just talk to me like a friend.</p>
      <div className="mt-4 flex flex-wrap gap-2">{chips.map((chip) => <button key={chip.mood} type="button" onClick={() => setMood(mood === chip.mood ? "all" : chip.mood)} className={`rounded-full border px-3 py-2 text-sm font-semibold transition ${mood === chip.mood ? "border-rose-500 bg-rose-600 text-white" : "border-zinc-200 bg-white text-zinc-700 hover:border-rose-200"}`}>{chip.icon} {chip.label}</button>)}</div>
      <div className="mt-4 flex gap-2"><input value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder='“We have two hours, it’s hot, and I don’t want to spend much.”' className="min-w-0 flex-1 rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100" /><button type="button" onClick={() => setPrompt(prompt.trim())} className="rounded-2xl bg-zinc-900 px-4 py-3 text-sm font-bold text-white">Find</button></div>
      <div className="mt-3 flex flex-wrap items-center gap-2"><button type="button" onClick={locate} className={`rounded-full border px-3 py-2 text-xs font-bold ${usingCurrent ? "border-rose-500 bg-rose-50 text-rose-700" : "border-zinc-200 bg-white text-zinc-700"}`}>📍 Find near me</button>{homeLat != null && homeLng != null && <button type="button" onClick={() => { setOrigin({ lat: homeLat, lng: homeLng }); setUsingCurrent(false); setMessage(null); }} className="rounded-full border border-zinc-200 bg-white px-3 py-2 text-xs font-bold text-zinc-700">🏠 Use home</button>}<span className="text-xs text-zinc-500">{greeting}</span></div>{message && <div className="mt-3 rounded-xl bg-white/80 px-3 py-2 text-xs text-zinc-600">{message}</div>}</div>
    <div className="border-t border-rose-100 bg-white/80 p-5 sm:p-6"><div className="flex items-end justify-between gap-3"><div><h3 className="font-display text-lg font-bold text-zinc-950">✨ Here&apos;s what I&apos;d pick</h3><p className="text-xs text-zinc-500">A few strong choices, not an endless scroll.</p></div>{results.length > 0 && <button type="button" onClick={() => setPlanOpen(!planOpen)} className="rounded-full bg-zinc-900 px-3 py-2 text-xs font-bold text-white">Build my day</button>}</div>
      {results.length === 0 ? <p className="mt-4 rounded-2xl bg-zinc-50 p-4 text-sm text-zinc-600">I don&apos;t have a verified match for those constraints yet. Try widening the distance or telling me a little more about what sounds fun.</p> : <div className="mt-4 grid gap-3">{results.map(({ place, distance }, index) => <article key={place.id} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm"><div className="flex items-start justify-between gap-3"><div><div className="text-xs font-bold uppercase tracking-wide text-rose-600">{index === 0 ? "Best match" : "Also good"}</div><h4 className="mt-1 font-bold text-zinc-950">{place.name}</h4><p className="mt-1 text-xs text-zinc-500">{distance != null ? `${Math.round(distance)} mi away` : "Distance unavailable"}{place.price_note ? ` · ${place.price_note}` : ""}</p></div><span className="text-xl">{place.is_outdoor ? "🌳" : "🏠"}</span></div><div className="mt-3 flex flex-wrap gap-1.5">{childAgeMonths != null && <span className="rounded-full bg-rose-50 px-2 py-1 text-[11px] font-semibold text-rose-700">Toddler fit</span>}{place.restrooms && <span className="rounded-full bg-zinc-100 px-2 py-1 text-[11px]">Restrooms</span>}{place.stroller_accessible && <span className="rounded-full bg-zinc-100 px-2 py-1 text-[11px]">Stroller</span>}{place.has_changing_table && <span className="rounded-full bg-zinc-100 px-2 py-1 text-[11px]">Changing table</span>}</div>{place.toddler_notes && <p className="mt-3 text-sm leading-5 text-zinc-600"><b>Why:</b> {place.toddler_notes}</p>}</article>)}</div>}
      {planOpen && results.length > 0 && <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4"><div className="font-bold text-zinc-900">A simple plan</div><ol className="mt-2 space-y-2 text-sm text-zinc-700">{results.slice(0, 3).map((r, i) => <li key={r.place.id}><b>{i + 1}. {r.place.name}</b>{r.distance != null ? ` · ${Math.round(r.distance)} mi` : ""}{i === 0 ? " · Start here" : i === 1 ? " · Optional second stop" : " · Optional final stop"}</li>)}</ol><p className="mt-3 text-xs text-zinc-500">The next Explorer layer will combine event timing and weather into a true time-aware itinerary.</p></div>}
    </div>
  </section>;
}
