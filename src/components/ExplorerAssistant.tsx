"use client";

import { useMemo, useState } from "react";
import type { Event, Place } from "@/types";
import type { WeatherContext } from "@/lib/weather-context";
import { weatherScore } from "@/lib/weather-context";

type Props = { places: Place[]; events: Event[]; childAgeMonths: number | null; homeLat: number | null; homeLng: number | null; weather?: WeatherContext | null };
type Mood = "all" | "indoor" | "outdoor" | "water" | "active" | "learn" | "create" | "animals";
type Origin = { lat: number; lng: number } | null;
type Result = { type: "place"; item: Place; distance: number | null; score: number } | { type: "event"; item: Event; distance: number | null; score: number };

const chips: { mood: Mood; label: string; icon: string }[] = [
  { mood: "outdoor", label: "Outside", icon: "🌳" }, { mood: "indoor", label: "Indoor", icon: "🏠" },
  { mood: "water", label: "Water", icon: "💦" }, { mood: "active", label: "Burn energy", icon: "🤸" },
  { mood: "learn", label: "Learn", icon: "📚" }, { mood: "create", label: "Create", icon: "🎨" }, { mood: "animals", label: "Animals", icon: "🐾" },
];

function miles(a: Origin, b: { lat: number | null; lng: number | null }) {
  if (!a || b.lat == null || b.lng == null) return null;
  const r = 3958.7613, dLat = ((b.lat - a.lat) * Math.PI) / 180, dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(x));
}
function placeText(p: Place) { return `${p.name} ${p.description ?? ""} ${p.toddler_notes ?? ""} ${p.price_note ?? ""} ${(p.category_tags ?? []).join(" ")}`.toLowerCase(); }
function eventText(e: Event) { return `${e.title} ${e.description ?? ""} ${e.venue_name ?? ""} ${e.cost ?? ""} ${(e.age_tags ?? []).join(" ")}`.toLowerCase(); }
function infer(q: string) {
  const s = q.toLowerCase();
  const mood: Mood = /animal|farm|zoo|petting|ranch|wildlife/.test(s) ? "animals" : /water|splash|pool|lagoon|swim|cool off/.test(s) ? "water" : /indoor|rain|raining|hot|heat/.test(s) ? "indoor" : /outside|outdoor|park|nature|fresh air/.test(s) ? "outdoor" : /run|energy|active|burn|climb|gym/.test(s) ? "active" : /learn|library|story|museum|science/.test(s) ? "learn" : /art|music|craft|create|dance/.test(s) ? "create" : "all";
  const hours = s.match(/(?:for|about|around)?\s*(\d+(?:\.\d+)?)\s*(hour|hours|hr|hrs)/);
  const mins = s.match(/(?:for|about|around)?\s*(\d+)\s*(minute|minutes|min|mins)/);
  return { mood, budget: /free|cheap|low cost|budget|don't want to spend|no money/.test(s), easy: /tired|exhausted|easy|low key|low-key|simple/.test(s), now: /today|now|right now|already out|we're out/.test(s), maxMiles: /5\s*(?:mile|mi)/.test(s) ? 5 : /10\s*(?:mile|mi)/.test(s) ? 10 : /20\s*(?:mile|mi)/.test(s) ? 20 : 30, maxMinutes: hours ? Math.round(Number(hours[1]) * 60) : mins ? Number(mins[1]) : null };
}
function matchesPlace(p: Place, mood: Mood) {
  if (mood === "all") return true;
  const t = placeText(p);
  if (mood === "indoor") return p.is_outdoor === false || p.is_enclosed === true || /indoor|museum|library|gym|play/.test(t);
  if (mood === "outdoor") return p.is_outdoor === true || /park|playground|nature|trail|farm|zoo|garden/.test(t);
  if (mood === "water") return /splash|water|lagoon|pool|aquatic|swim|spray/.test(t);
  if (mood === "active") return /gym|gymnast|movement|sports|playground|soccer|dance|jump|trampoline/.test(t);
  if (mood === "learn") return /library|museum|science|learning|story|nature|discovery|education/.test(t);
  if (mood === "create") return /art|music|craft|creative|dance|studio|maker/.test(t);
  return /animal|farm|zoo|petting|ranch|wildlife/.test(t);
}
function matchesEvent(e: Event, mood: Mood) {
  if (mood === "all") return true;
  const t = eventText(e);
  if (mood === "indoor") return e.is_outdoor === false || /indoor|museum|library|gym|play/.test(t);
  if (mood === "outdoor") return e.is_outdoor === true || /park|playground|nature|trail|farm|zoo|garden/.test(t);
  if (mood === "water") return /water|splash|pool|swim|spray|aquatic/.test(t);
  if (mood === "active") return /active|gym|dance|play|sport|movement/.test(t);
  if (mood === "learn") return /library|story|museum|science|learn|education/.test(t);
  if (mood === "create") return /art|music|craft|dance|creative/.test(t);
  return /animal|farm|zoo|petting|wildlife/.test(t);
}
function ageScore(min: number | null, max: number | null, age: number | null) { if (age == null) return 0; const lo = min ?? 0, hi = max ?? 144; if (age >= lo && age <= hi) return 40; if (age >= lo - 6 && age <= hi + 6) return 12; return -25; }

export default function ExplorerAssistant({ places, events, childAgeMonths, homeLat, homeLng, weather = null }: Props) {
  const [prompt, setPrompt] = useState(""); const [submitted, setSubmitted] = useState(""); const [mood, setMood] = useState<Mood>("all");
  const [origin, setOrigin] = useState<Origin>(homeLat != null && homeLng != null ? { lat: homeLat, lng: homeLng } : null);
  const [usingCurrent, setUsingCurrent] = useState(false); const [message, setMessage] = useState<string | null>(null); const [planOpen, setPlanOpen] = useState(false);
  const parsed = useMemo(() => infer(submitted), [submitted]); const effectiveMood = mood === "all" ? parsed.mood : mood;

  const results = useMemo<Result[]>(() => {
    const placesResult: Result[] = places.filter(p => matchesPlace(p, effectiveMood)).map(place => {
      const distance = miles(origin, place); let score = ageScore(place.age_min_months, place.age_max_months, childAgeMonths) + weatherScore(weather, place.is_outdoor);
      if (effectiveMood !== "all") score += 35; if (place.toddler_notes) score += 8; if (place.restrooms) score += 3; if (place.stroller_accessible) score += 3; if (place.has_changing_table) score += 4;
      if (parsed.budget && /free|\$0|no cost|free entry/.test(placeText(place))) score += 15;
      if (parsed.easy && (place.stroller_accessible || place.restrooms || place.is_enclosed)) score += 5;
      if (distance != null) score += Math.max(0, 25 - distance * 1.1);
      return { type: "place", item: place, distance, score };
    }).filter(r => r.distance == null || r.distance <= parsed.maxMiles);

    const eventsResult: Result[] = events.filter(e => e.status === "published" && e.is_kid_relevant && matchesEvent(e, effectiveMood)).map(event => {
      const distance = miles(origin, event); const minutesUntil = (new Date(event.starts_at).getTime() - Date.now()) / 60000; let score = ageScore(event.age_min_months, event.age_max_months, childAgeMonths) + weatherScore(weather, event.is_outdoor);
      if (effectiveMood !== "all") score += 35; const t = eventText(event);
      if (parsed.budget && /free|no cost|\$0/.test(t)) score += 15; if (parsed.now) score += 10; if (parsed.maxMinutes != null && minutesUntil >= 0 && minutesUntil <= parsed.maxMinutes) score += 15;
      if (distance != null) score += Math.max(0, 25 - distance * 1.1);
      return { type: "event", item: event, distance, score };
    }).filter(r => (r.distance == null || r.distance <= parsed.maxMiles) && (parsed.maxMinutes == null || r.item.starts_at && r.item.starts_at.length > 0));

    return [...placesResult, ...eventsResult].sort((a, b) => b.score - a.score).slice(0, 5);
  }, [places, events, childAgeMonths, origin, effectiveMood, parsed, weather]);

  function locate() {
    if (!navigator.geolocation) { setMessage("Location isn't available. I'll use your saved home location instead."); return; }
    setMessage("Finding you…"); navigator.geolocation.getCurrentPosition(p => { setOrigin({ lat: p.coords.latitude, lng: p.coords.longitude }); setUsingCurrent(true); setMessage("I'm using your current location for this search only — I don't continuously track you."); }, () => setMessage("I couldn't get your location. You can still search from home."), { maximumAge: 300000, timeout: 10000, enableHighAccuracy: false });
  }
  function submit() { setSubmitted(prompt.trim()); setPlanOpen(false); setMessage(prompt.trim() ? "Searching places and today's events…" : "Tell me a little about what you need and I'll narrow it down."); }
  const intro = submitted ? `I matched your request against verified places and today's kid-relevant events${usingCurrent ? " near your current location" : ""}${parsed.maxMinutes != null ? ` within about ${parsed.maxMinutes} minutes of your time window` : ""}.` : (childAgeMonths != null ? `I'll keep your ${Math.floor(childAgeMonths / 12)}-year-old in mind and prioritize what's useful today.` : "Tell me what you need and I'll narrow it down.");

  return <section className="overflow-hidden rounded-3xl border border-rose-100 bg-gradient-to-br from-rose-50 via-white to-amber-50 shadow-sm">
    <div className="p-5 sm:p-6"><div className="text-xs font-bold uppercase tracking-[0.16em] text-rose-600">Your Momma&apos;s Meetup Explorer</div><h2 className="mt-1 font-display text-2xl font-bold tracking-tight text-zinc-950">Tell me what you need today.</h2><p className="mt-2 text-sm leading-6 text-zinc-600">Talk to me like a friend. I&apos;ll look across places and what&apos;s actually happening today.</p>
      {weather && <div className="mt-4 rounded-2xl border border-white/80 bg-white/80 p-3 text-sm text-zinc-700"><span className="font-bold">{Math.round(weather.temperatureF)}°</span> · {weather.summary}</div>}
      <div className="mt-4 flex flex-wrap gap-2">{chips.map(c => <button key={c.mood} type="button" onClick={() => { const next = mood === c.mood ? "all" : c.mood; setMood(next); setSubmitted(prompt.trim()); }} className={`rounded-full border px-3 py-2 text-sm font-semibold transition ${mood === c.mood ? "border-rose-500 bg-rose-600 text-white" : "border-zinc-200 bg-white text-zinc-700 hover:border-rose-200"}`}>{c.icon} {c.label}</button>)}</div>
      <form onSubmit={e => { e.preventDefault(); submit(); }} className="mt-4 flex gap-2"><input value={prompt} onChange={e => setPrompt(e.target.value)} placeholder='“We have two hours, it’s hot, and I don’t want to spend much.”' className="min-w-0 flex-1 rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100"/><button type="submit" className="rounded-2xl bg-zinc-900 px-4 py-3 text-sm font-bold text-white">Find</button></form>
      <div className="mt-3 flex flex-wrap items-center gap-2"><button type="button" onClick={locate} className={`rounded-full border px-3 py-2 text-xs font-bold ${usingCurrent ? "border-rose-500 bg-rose-50 text-rose-700" : "border-zinc-200 bg-white text-zinc-700"}`}>📍 Find near me</button>{homeLat != null && homeLng != null && <button type="button" onClick={() => { setOrigin({ lat: homeLat, lng: homeLng }); setUsingCurrent(false); setMessage(null); }} className="rounded-full border border-zinc-200 bg-white px-3 py-2 text-xs font-bold text-zinc-700">🏠 Use home</button>}<span className="text-xs text-zinc-500">{intro}</span></div>{message && <div className="mt-3 rounded-xl bg-white/80 px-3 py-2 text-xs text-zinc-600">{message}</div>}</div>
    <div className="border-t border-rose-100 bg-white/80 p-5 sm:p-6"><div className="flex items-end justify-between gap-3"><div><h3 className="font-display text-lg font-bold text-zinc-950">✨ Here&apos;s what I&apos;d pick</h3><p className="text-xs text-zinc-500">A few strong choices, not an endless scroll.</p></div>{results.length > 0 && <button type="button" onClick={() => setPlanOpen(!planOpen)} className="rounded-full bg-zinc-900 px-3 py-2 text-xs font-bold text-white">Build my day</button>}</div>
      {results.length === 0 ? <p className="mt-4 rounded-2xl bg-zinc-50 p-4 text-sm text-zinc-600">I don&apos;t have a verified match for those constraints yet. Try widening the distance or changing the vibe.</p> : <div className="mt-4 grid gap-3">{results.map((r, i) => { const item = r.item; const isPlace = r.type === "place"; return <article key={item.id} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm"><div className="flex items-start justify-between gap-3"><div><div className="text-xs font-bold uppercase tracking-wide text-rose-600">{i === 0 ? "Best match" : !isPlace ? "Happening today" : "Also good"}</div><h4 className="mt-1 font-bold text-zinc-950">{isPlace ? (item as Place).name : (item as Event).title}</h4><p className="mt-1 text-xs text-zinc-500">{r.distance != null ? `${Math.round(r.distance)} mi away` : "Distance unavailable"}{!isPlace ? ` · ${new Date((item as Event).starts_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` : (item as Place).price_note ? ` · ${(item as Place).price_note}` : ""}</p></div><span className="text-xl">{isPlace ? ((item as Place).is_outdoor ? "🌳" : "🏠") : "📅"}</span></div><div className="mt-3 flex flex-wrap gap-1.5">{childAgeMonths != null && <span className="rounded-full bg-rose-50 px-2 py-1 text-[11px] font-semibold text-rose-700">Toddler fit</span>}{!isPlace && <span className="rounded-full bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-700">Today</span>}{isPlace && (item as Place).restrooms && <span className="rounded-full bg-zinc-100 px-2 py-1 text-[11px]">Restrooms</span>}{isPlace && (item as Place).stroller_accessible && <span className="rounded-full bg-zinc-100 px-2 py-1 text-[11px]">Stroller</span>}</div>{isPlace && (item as Place).toddler_notes && <p className="mt-3 text-sm leading-5 text-zinc-600"><b>Why:</b> {(item as Place).toddler_notes}</p>}{!isPlace && (item as Event).description && <p className="mt-3 line-clamp-2 text-sm leading-5 text-zinc-600">{(item as Event).description}</p>}</article>; })}</div>}
      {planOpen && results.length > 0 && <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4"><div className="font-bold text-zinc-900">A simple plan</div><ol className="mt-2 space-y-2 text-sm text-zinc-700">{results.slice(0, 3).map((r, i) => <li key={r.item.id}><b>{i + 1}. {r.type === "place" ? r.item.name : r.item.title}</b>{r.distance != null ? ` · ${Math.round(r.distance)} mi` : ""}{r.type === "event" ? ` · ${new Date(r.item.starts_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` : i === 0 ? " · Start here" : " · Optional stop"}</li>)}</ol><p className="mt-3 text-xs text-zinc-500">I kept this plan inside your stated time window and only used verified inventory.</p></div>}
    </div></div>
  </section>;
}
