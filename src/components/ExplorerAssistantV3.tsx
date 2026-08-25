"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import PlaceCard from "@/components/PlaceCard";
import { distanceKm } from "@/lib/distance";
import { isFreeCost } from "@/lib/cost";
import type { WeatherContext } from "@/lib/weather-context";
import { weatherScore } from "@/lib/weather-context";
import type { FeedEvent, Place, PlaceTip } from "@/types";

type Props = {
  places: Place[];
  events: FeedEvent[];
  groupId: string | null;
  groupName: string | null;
  currentUserId: string;
  tipsByPlace: Record<string, (PlaceTip & { display_name: string })[]>;
  childAgeMonths: number | null;
  homeLat: number | null;
  homeLng: number | null;
  weather?: WeatherContext | null;
};
type Mood = "all" | "indoor" | "outdoor" | "water" | "active" | "learn" | "create" | "animals";
type Origin = { lat: number; lng: number } | null;
type PlaceResult = { type: "place"; item: Place; distanceMiles: number | null; score: number };
type EventResult = { type: "event"; item: FeedEvent; distanceMiles: number | null; score: number };
type Result = PlaceResult | EventResult;

const chips: { mood: Mood; label: string; icon: string }[] = [
  { mood: "outdoor", label: "Outside", icon: "🌳" }, { mood: "indoor", label: "Indoor", icon: "🏠" }, { mood: "water", label: "Water", icon: "💦" },
  { mood: "active", label: "Burn energy", icon: "🤸" }, { mood: "learn", label: "Learn", icon: "📚" }, { mood: "create", label: "Create", icon: "🎨" }, { mood: "animals", label: "Animals", icon: "🐾" },
];

function distanceMilesBetween(origin: Origin, point: { lat: number | null; lng: number | null }): number | null {
  if (!origin || point.lat == null || point.lng == null) return null;
  return distanceKm(origin.lat, origin.lng, point.lat, point.lng) * 0.621371;
}

function infer(q: string) {
  const s = q.toLowerCase();
  const mood: Mood = /animal|farm|zoo|petting|ranch|wildlife/.test(s) ? "animals" : /water|splash|pool|lagoon|swim|cool off/.test(s) ? "water" : /indoor|rain|raining/.test(s) ? "indoor" : /outside|outdoor|park|nature|fresh air/.test(s) ? "outdoor" : /run|energy|active|burn|climb|gym/.test(s) ? "active" : /learn|library|story|museum|science/.test(s) ? "learn" : /art|music|craft|create|dance/.test(s) ? "create" : "all";
  const hours = s.match(/(?:for|about|around)?\s*(\d+(?:\.\d+)?)\s*(hour|hours|hr|hrs)/); const minutes = s.match(/(?:for|about|around)?\s*(\d+)\s*(minute|minutes|min|mins)/);
  const maxMinutes = hours ? Math.round(Number(hours[1]) * 60) : minutes ? Number(minutes[1]) : null;
  return { mood, budget: /free|cheap|low cost|budget|don't want to spend|no money/.test(s), maxMiles: /5\s*(?:mile|mi)/.test(s) ? 5 : /10\s*(?:mile|mi)/.test(s) ? 10 : /20\s*(?:mile|mi)/.test(s) ? 20 : 30, maxMinutes };
}

// Matches on the real, already-populated taxonomy — weather_fit/
// experience_type for events, category_tags for places — instead of
// guessing a mood from free-text titles/descriptions. infer() above still
// reads the query text (that's interpreting what the *viewer* typed, not
// mischaracterizing a place/event's own data).
function matchesPlace(p: Place, mood: Mood) {
  if (mood === "all") return true;
  if (mood === "indoor") return p.category_tags.includes("indoor") || p.is_outdoor === false;
  if (mood === "outdoor") return p.category_tags.some((t) => t === "outdoor" || t === "playground") || p.is_outdoor === true;
  if (mood === "water") return p.category_tags.includes("water_play");
  if (mood === "active") return p.category_tags.some((t) => t === "active_play" || t === "playground");
  if (mood === "learn") return p.category_tags.includes("storytime");
  if (mood === "create") return p.category_tags.includes("arts_learning");
  return p.category_tags.includes("animals");
}
function matchesEvent(e: FeedEvent, mood: Mood) {
  if (mood === "all") return true;
  if (mood === "indoor") return e.weather_fit === "indoor" || e.is_outdoor === false;
  if (mood === "outdoor") return e.weather_fit === "outdoor" || e.is_outdoor === true;
  if (mood === "water") return e.weather_fit === "water";
  if (mood === "active") return e.experience_type === "music_movement";
  if (mood === "learn") return e.experience_type === "storytime_experience" || e.experience_type === "community_helper";
  if (mood === "create") return e.experience_type === "hands_on";
  return e.experience_type === "animal";
}
function ageScore(min: number | null, max: number | null, age: number | null) { if (age == null) return 0; const lo = min ?? 0, hi = max ?? 144; if (age >= lo && age <= hi) return 40; if (age >= lo - 6 && age <= hi + 6) return 12; return -25; }

export default function ExplorerAssistantV3({ places, events, groupId, groupName, currentUserId, tipsByPlace, childAgeMonths, homeLat, homeLng, weather = null }: Props) {
  const [prompt, setPrompt] = useState(""); const [submitted, setSubmitted] = useState(""); const [mood, setMood] = useState<Mood>("all"); const [origin, setOrigin] = useState<Origin>(homeLat != null && homeLng != null ? { lat: homeLat, lng: homeLng } : null); const [usingCurrent, setUsingCurrent] = useState(false); const [message, setMessage] = useState<string | null>(null);
  const parsed = useMemo(() => infer(submitted), [submitted]); const effectiveMood = mood === "all" ? parsed.mood : mood;
  const results = useMemo<Result[]>(() => {
    const placeResults: PlaceResult[] = places.filter(p => matchesPlace(p, effectiveMood)).map((place): PlaceResult => { const distance = distanceMilesBetween(origin, place); let score = ageScore(place.age_min_months, place.age_max_months, childAgeMonths) + weatherScore(weather, place.is_outdoor); if (effectiveMood !== "all") score += 35; if (place.toddler_notes) score += 8; if (place.restrooms) score += 3; if (place.stroller_accessible) score += 3; if (place.has_changing_table) score += 4; if (parsed.budget && /free|\$0|no cost|free entry/i.test(place.price_note ?? "")) score += 15; if (distance != null) score += Math.max(0, 25 - distance * 1.1); return { type: "place", item: place, distanceMiles: distance, score }; }).filter(r => r.distanceMiles == null || r.distanceMiles <= parsed.maxMiles);
    const eventResults: EventResult[] = events.filter(e => matchesEvent(e, effectiveMood)).map((event): EventResult => { const distance = distanceMilesBetween(origin, event); let score = ageScore(event.age_min_months, event.age_max_months, childAgeMonths) + weatherScore(weather, event.is_outdoor); if (effectiveMood !== "all") score += 35; if (parsed.budget && isFreeCost(event.cost)) score += 15; if (distance != null) score += Math.max(0, 25 - distance * 1.1); return { type: "event", item: event, distanceMiles: distance, score }; }).filter(r => r.distanceMiles == null || r.distanceMiles <= parsed.maxMiles);
    return [...placeResults, ...eventResults].sort((a, b) => b.score - a.score).slice(0, 5);
  }, [places, events, childAgeMonths, origin, effectiveMood, parsed, weather]);
  function locate() { if (!navigator.geolocation) { setMessage("Location isn't available. I'll use your saved home location instead."); return; } setMessage("Finding you…"); navigator.geolocation.getCurrentPosition(p => { setOrigin({ lat: p.coords.latitude, lng: p.coords.longitude }); setUsingCurrent(true); setMessage("Using your current location for this search only — no continuous tracking."); }, () => setMessage("I couldn't get your location. You can still search from home."), { maximumAge: 300000, timeout: 10000, enableHighAccuracy: false }); }
  function submit() { setSubmitted(prompt.trim()); setMessage(prompt.trim() ? "Searching places and today's events…" : "Tell me a little about what you need and I'll narrow it down."); }
  return <section className="overflow-hidden rounded-3xl border border-rose-100 bg-gradient-to-br from-rose-50 via-white to-amber-50 shadow-sm"><div className="p-5 sm:p-6"><div className="text-xs font-bold uppercase tracking-[0.16em] text-rose-600">Your Momma&apos;s Meetup Explorer</div><h2 className="mt-1 font-display text-2xl font-bold tracking-tight text-zinc-950">Tell me what you need today.</h2><p className="mt-2 text-sm leading-6 text-zinc-600">Talk to me like a friend. I&apos;ll look across places and what&apos;s actually happening today.</p>{weather && <div className="mt-4 rounded-2xl border border-white/80 bg-white/80 p-3 text-sm text-zinc-700"><span className="font-bold">{Math.round(weather.temperatureF)}°</span> · {weather.summary}</div>}<div className="mt-4 flex flex-wrap gap-2">{chips.map(c => <button key={c.mood} type="button" onClick={() => setMood(mood === c.mood ? "all" : c.mood)} className={`rounded-full border px-3 py-2 text-sm font-semibold ${mood === c.mood ? "border-rose-500 bg-rose-600 text-white" : "border-zinc-200 bg-white text-zinc-700"}`}>{c.icon} {c.label}</button>)}</div><form onSubmit={e => { e.preventDefault(); submit(); }} className="mt-4 flex gap-2"><input value={prompt} onChange={e => setPrompt(e.target.value)} placeholder="“We have two hours, it’s hot, and I don’t want to spend much.”" className="min-w-0 flex-1 rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100"/><button type="submit" className="rounded-2xl bg-zinc-900 px-4 py-3 text-sm font-bold text-white">Find</button></form><div className="mt-3 flex flex-wrap items-center gap-2"><button type="button" onClick={locate} className={`rounded-full border px-3 py-2 text-xs font-bold ${usingCurrent ? "border-rose-500 bg-rose-50 text-rose-700" : "border-zinc-200 bg-white text-zinc-700"}`}>📍 Find near me</button>{homeLat != null && homeLng != null && <button type="button" onClick={() => { setOrigin({ lat: homeLat, lng: homeLng }); setUsingCurrent(false); setMessage(null); }} className="rounded-full border border-zinc-200 bg-white px-3 py-2 text-xs font-bold text-zinc-700">🏠 Use home</button>}<span className="text-xs text-zinc-500">{submitted ? `Matched against verified places and today’s kid-relevant events${usingCurrent ? " near you" : ""}.` : childAgeMonths != null ? `I’ll keep your ${Math.floor(childAgeMonths / 12)}-year-old in mind.` : "Tell me what you need and I’ll narrow it down."}</span></div>{message && <div className="mt-3 rounded-xl bg-white/80 px-3 py-2 text-xs text-zinc-600">{message}</div>}</div><div className="border-t border-rose-100 bg-white/80 p-5 sm:p-6"><div><h3 className="font-display text-lg font-bold text-zinc-950">✨ Here&apos;s what I&apos;d pick</h3><p className="text-xs text-zinc-500">A few strong choices, not an endless scroll.</p></div>{results.length === 0 ? <p className="mt-4 rounded-2xl bg-zinc-50 p-4 text-sm text-zinc-600">I don&apos;t have a verified match for those constraints yet. Try widening the distance or changing the vibe.</p> : <div className="mt-4 flex flex-col gap-4">{results.map((r, i) => <div key={`${r.type}-${r.item.id}`}><div className="mb-1.5 text-xs font-bold uppercase tracking-wide text-rose-600">{i === 0 ? "Best match" : r.type === "event" ? "Happening today" : "Also good"}</div>{r.type === "place" ? <PlaceCard place={r.item} groupId={groupId} groupName={groupName} currentUserId={currentUserId} tips={tipsByPlace[r.item.id] ?? []} distance={r.distanceMiles != null ? { km: r.distanceMiles / 0.621371 } : undefined} childAgeMonths={childAgeMonths} /> : <Link href={`/events/${r.item.id}`} className="block rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm transition hover:border-rose-200"><div className="flex items-start justify-between gap-3"><div><h4 className="font-bold text-zinc-950">{r.item.title}</h4><p className="mt-1 text-xs text-zinc-500">{r.distanceMiles != null ? `${r.distanceMiles.toFixed(1)} mi away` : "Distance unavailable"} · {new Date(r.item.starts_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</p></div><span className="text-xl">📅</span></div><div className="mt-3 flex flex-wrap gap-1.5">{childAgeMonths != null && <span className="rounded-full bg-rose-50 px-2 py-1 text-[11px] font-semibold text-rose-700">Age fit</span>}<span className="rounded-full bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-700">Today</span></div>{r.item.description && <p className="mt-3 text-sm leading-5 text-zinc-600">{r.item.description}</p>}</Link>}</div>)}</div>}</div></section>;
}
