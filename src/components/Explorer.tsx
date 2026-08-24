"use client";

import { useMemo, useState } from "react";
import PlaceCard from "./PlaceCard";
import type { Place, PlaceTip } from "@/types";

type Props = {
  places: Place[];
  groupId: string | null;
  groupName: string | null;
  currentUserId: string;
  tipsByPlace: Record<string, (PlaceTip & { display_name: string })[]>;
  childAgeMonths: number | null;
  homeLat: number | null;
  homeLng: number | null;
};

type Mood = "all" | "outdoor" | "indoor" | "water" | "active" | "learn" | "create" | "animals";

type LocationMode = "home" | "current" | "anywhere";

const moods: { id: Mood; label: string; icon: string }[] = [
  { id: "outdoor", label: "Outside", icon: "🌳" },
  { id: "indoor", label: "Indoor", icon: "🏠" },
  { id: "water", label: "Water", icon: "💦" },
  { id: "active", label: "Get active", icon: "🤸" },
  { id: "learn", label: "Learn", icon: "📚" },
  { id: "create", label: "Create", icon: "🎨" },
  { id: "animals", label: "Animals", icon: "🐐" },
];

function distanceMiles(lat1: number, lng1: number, lat2: number, lng2: number) {
  const r = 3958.7613;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(a));
}

function textFor(place: Place) {
  return `${place.name} ${place.description ?? ""} ${place.toddler_notes ?? ""}`.toLowerCase();
}

function matchesMood(place: Place, mood: Mood) {
  if (mood === "all") return true;
  const text = textFor(place);
  if (mood === "outdoor") return place.is_outdoor || /park|playground|nature|trail|farm|zoo|garden|outdoor/.test(text);
  if (mood === "indoor") return !place.is_outdoor || place.is_enclosed === true || /indoor|museum|library|gym|playtown|play cafe/.test(text);
  if (mood === "water") return /splash|water|lagoon|pool|aquatic|swim|spray/.test(text);
  if (mood === "active") return /gym|gymnast|movement|sports|playground|active|soccer|dance|jump|trampoline/.test(text);
  if (mood === "learn") return /library|museum|science|learning|story|nature|discovery|education/.test(text);
  if (mood === "create") return /art|music|craft|creative|dance|studio|maker/.test(text);
  return /animal|farm|zoo|petting|ranch|wildlife/.test(text);
}

function ageFit(place: Place, childAgeMonths: number | null) {
  if (childAgeMonths == null) return 0;
  const min = place.age_min_months ?? 0;
  const max = place.age_max_months ?? 144;
  if (childAgeMonths >= min && childAgeMonths <= max) return 35;
  if (childAgeMonths >= min - 6 && childAgeMonths <= max + 6) return 10;
  return -25;
}

function score(place: Place, mood: Mood, childAgeMonths: number | null, origin: { lat: number; lng: number } | null) {
  let value = 0;
  value += ageFit(place, childAgeMonths);
  if (matchesMood(place, mood)) value += mood === "all" ? 0 : 28;
  if (place.toddler_notes) value += 8;
  if (place.restrooms) value += 3;
  if (place.stroller_accessible) value += 3;
  if (place.has_changing_table) value += 4;
  if (place.quiet_or_sensory_friendly) value += 3;
  if (origin && place.lat != null && place.lng != null) {
    const miles = distanceMiles(origin.lat, origin.lng, place.lat, place.lng);
    value += Math.max(0, 24 - miles * 1.2);
  }
  return value;
}

export default function Explorer({ places, groupId, groupName, currentUserId, tipsByPlace, childAgeMonths, homeLat, homeLng }: Props) {
  const [mood, setMood] = useState<Mood>("all");
  const [query, setQuery] = useState("");
  const [distanceLimit, setDistanceLimit] = useState(30);
  const [locationMode, setLocationMode] = useState<LocationMode>(homeLat != null && homeLng != null ? "home" : "anywhere");
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationMessage, setLocationMessage] = useState<string | null>(null);
  const [view, setView] = useState<"list" | "map">("list");
  const [showFilters, setShowFilters] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);

  const origin = locationMode === "home" && homeLat != null && homeLng != null
    ? { lat: homeLat, lng: homeLng }
    : locationMode === "current"
      ? currentLocation
      : null;

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      setLocationMessage("Your device doesn't provide location services. You can still explore by distance from home.");
      return;
    }
    setLocationMessage("Finding your location…");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCurrentLocation({ lat: position.coords.latitude, lng: position.coords.longitude });
        setLocationMode("current");
        setLocationMessage("Using your current location for this search. We don't continuously track you.");
      },
      () => setLocationMessage("Location permission wasn't available. You can choose Home or search Anywhere."),
      { enableHighAccuracy: false, maximumAge: 300000, timeout: 10000 },
    );
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return places
      .filter((place) => matchesMood(place, mood))
      .filter((place) => {
        if (!q) return true;
        return textFor(place).includes(q) || (place.address ?? "").toLowerCase().includes(q);
      })
      .map((place) => ({
        place,
        miles: origin && place.lat != null && place.lng != null ? distanceMiles(origin.lat, origin.lng, place.lat, place.lng) : null,
        score: score(place, mood, childAgeMonths, origin),
      }))
      .filter(({ miles }) => miles == null || miles <= distanceLimit)
      .sort((a, b) => b.score - a.score);
  }, [places, mood, query, distanceLimit, origin, childAgeMonths]);

  const recommendations = filtered.slice(0, 4);
  const morePlaces = filtered.slice(4);

  const assistantText = useMemo(() => {
    const lower = query.toLowerCase();
    const parts: string[] = [];
    if (/rain|raining|hot|heat|inside|indoor/.test(lower)) parts.push("I'll lean toward indoor options.");
    if (/cheap|free|budget|money/.test(lower)) parts.push("I'll favor free or low-cost options when the place data supports it.");
    if (/tired|easy|exhausted/.test(lower)) parts.push("I'll prioritize easy, low-friction outings.");
    if (/run|energy|active|burn/.test(lower)) parts.push("I'll prioritize places where little ones can move.");
    if (!parts.length) return childAgeMonths != null ? `I'm looking for places that fit your ${Math.floor(childAgeMonths / 12)}-year-old and your current vibe.` : "Tell me what you're in the mood for and I'll narrow it down.";
    return parts.join(" ");
  }, [query, childAgeMonths]);

  return (
    <div className="flex flex-col gap-5">
      <section className="overflow-hidden rounded-3xl border border-rose-100 bg-gradient-to-br from-rose-50 via-white to-amber-50 p-5 shadow-sm">
        <div className="mb-1 text-xs font-bold uppercase tracking-[0.16em] text-rose-600">Momma&apos;s Meetup Explorer</div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-zinc-950">What do you want to do today?</h1>
        <p className="mt-2 max-w-xl text-sm leading-6 text-zinc-600">Tell me the vibe, or just tell me what&apos;s going on. I&apos;ll narrow the options instead of making you scroll through everything.</p>

        <div className="mt-4 flex flex-wrap gap-2">
          {moods.map((item) => (
            <button key={item.id} type="button" onClick={() => setMood(mood === item.id ? "all" : item.id)} className={`rounded-full border px-3 py-2 text-sm font-semibold transition ${mood === item.id ? "border-rose-500 bg-rose-600 text-white" : "border-zinc-200 bg-white text-zinc-700 hover:border-rose-200"}`}>
              {item.icon} {item.label}
            </button>
          ))}
        </div>

        <label className="mt-4 block">
          <span className="sr-only">Tell Explorer what you need</span>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder='Try “indoor, cheap, and my toddler needs to burn some energy”' className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm outline-none ring-0 placeholder:text-zinc-400 focus:border-rose-400 focus:ring-2 focus:ring-rose-100" />
        </label>
        <p className="mt-2 text-xs text-zinc-500">{assistantText}</p>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm font-bold text-zinc-900">Where are you today?</div>
            <div className="mt-1 text-xs text-zinc-500">Use home, your current location, or explore without a location.</div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setLocationMode("home")} disabled={homeLat == null || homeLng == null} className={`rounded-full border px-3 py-2 text-xs font-semibold ${locationMode === "home" ? "border-rose-500 bg-rose-50 text-rose-700" : "border-zinc-200 text-zinc-600"}`}>🏠 Home</button>
            <button type="button" onClick={useCurrentLocation} className={`rounded-full border px-3 py-2 text-xs font-semibold ${locationMode === "current" ? "border-rose-500 bg-rose-50 text-rose-700" : "border-zinc-200 text-zinc-600"}`}>📍 I&apos;m somewhere else</button>
            <button type="button" onClick={() => setLocationMode("anywhere")} className={`rounded-full border px-3 py-2 text-xs font-semibold ${locationMode === "anywhere" ? "border-rose-500 bg-rose-50 text-rose-700" : "border-zinc-200 text-zinc-600"}`}>🗺️ Anywhere</button>
          </div>
        </div>
        {locationMessage && <p className="mt-3 rounded-xl bg-zinc-50 px-3 py-2 text-xs text-zinc-600">{locationMessage}</p>}
      </section>

      <section className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-zinc-900">{origin ? "Near you" : "Explore"}</span>
          <select aria-label="Maximum distance" value={distanceLimit} onChange={(e) => setDistanceLimit(Number(e.target.value))} className="rounded-full border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-700">
            {[5, 10, 20, 30, 45].map((m) => <option key={m} value={m}>{m} mi</option>)}
          </select>
          <button type="button" onClick={() => setShowFilters(!showFilters)} className="rounded-full border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-700">Filters</button>
        </div>
        <div className="flex rounded-full border border-zinc-200 bg-white p-1">
          <button type="button" onClick={() => setView("list")} className={`rounded-full px-3 py-1.5 text-xs font-bold ${view === "list" ? "bg-zinc-900 text-white" : "text-zinc-500"}`}>List</button>
          <button type="button" onClick={() => setView("map")} className={`rounded-full px-3 py-1.5 text-xs font-bold ${view === "map" ? "bg-zinc-900 text-white" : "text-zinc-500"}`}>Map</button>
        </div>
      </section>

      {showFilters && (
        <section className="grid gap-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:grid-cols-2">
          <div><div className="text-xs font-bold uppercase tracking-wide text-zinc-400">Age</div><p className="mt-1 text-sm text-zinc-600">Recommendations automatically favor the child age saved on your profile.</p></div>
          <div><div className="text-xs font-bold uppercase tracking-wide text-zinc-400">Mom essentials</div><div className="mt-2 flex flex-wrap gap-2 text-xs text-zinc-600"><span className="rounded-full bg-zinc-100 px-2 py-1">✓ Fenced where known</span><span className="rounded-full bg-zinc-100 px-2 py-1">✓ Restrooms</span><span className="rounded-full bg-zinc-100 px-2 py-1">✓ Stroller</span><span className="rounded-full bg-zinc-100 px-2 py-1">✓ Changing table</span><span className="rounded-full bg-zinc-100 px-2 py-1">✓ Sensory friendly</span></div></div>
        </section>
      )}

      <section>
        <div className="mb-3 flex items-end justify-between gap-3">
          <div><h2 className="font-display text-xl font-bold text-zinc-950">⭐ Best matches for you</h2><p className="text-xs text-zinc-500">A few strong choices — not an endless feed.</p></div>
          <button type="button" onClick={() => setPlanOpen(!planOpen)} className="rounded-full bg-zinc-900 px-3 py-2 text-xs font-bold text-white">✨ Build my day</button>
        </div>
        {planOpen && recommendations.length > 0 && (
          <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4"><div className="text-sm font-bold text-zinc-900">A simple outing plan</div><div className="mt-2 grid gap-2 text-sm text-zinc-700">{recommendations.slice(0, 3).map((r, i) => <div key={r.place.id} className="flex gap-3"><span className="font-bold text-amber-700">{i + 1}</span><span><b>{r.place.name}</b>{r.miles != null ? ` · ${Math.round(r.miles)} mi away` : ""}{i === 0 ? " · Start here" : i === 1 ? " · Add a second stop if you have time" : " · Optional final stop"}</span></div>)}</div><p className="mt-3 text-xs text-zinc-500">This is a starting plan from your current filters. We can make it weather-aware and time-aware as the Explorer grows.</p></div>
        )}
        {recommendations.length === 0 ? <p className="rounded-2xl border border-dashed border-zinc-200 p-5 text-sm text-zinc-500">I couldn&apos;t find a good match with those filters. Try a wider distance or a different vibe.</p> : (
          <div className="flex flex-col gap-4">
            {recommendations.map(({ place, miles }) => <div key={place.id} className="relative"><PlaceCard place={place} groupId={groupId} groupName={groupName} currentUserId={currentUserId} tips={tipsByPlace[place.id] ?? []} />{miles != null && <span className="absolute right-3 top-3 rounded-full bg-white/95 px-2 py-1 text-[11px] font-bold text-zinc-600 shadow-sm">{miles < 10 ? miles.toFixed(1) : Math.round(miles)} mi</span>}</div>)}
          </div>
        )}
      </section>

      {view === "map" && <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-5 text-sm text-zinc-600"><b>Map view is next.</b> The location model is ready; this view will use the same filtered results and place coordinates without changing the recommendation logic.</div>}

      <section>
        <div className="mb-3 flex items-end justify-between"><div><h2 className="font-display text-xl font-bold text-zinc-950">More ideas</h2><p className="text-xs text-zinc-500">{morePlaces.length} more curated places match your current search.</p></div></div>
        <div className="flex flex-col gap-4">
          {morePlaces.map(({ place, miles }) => <div key={place.id} className="relative"><PlaceCard place={place} groupId={groupId} groupName={groupName} currentUserId={currentUserId} tips={tipsByPlace[place.id] ?? []} />{miles != null && <span className="absolute right-3 top-3 rounded-full bg-white/95 px-2 py-1 text-[11px] font-bold text-zinc-600 shadow-sm">{miles < 10 ? miles.toFixed(1) : Math.round(miles)} mi</span>}</div>)}
        </div>
      </section>
    </div>
  );
}
