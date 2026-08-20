import { redirect } from "next/navigation";
import { overlapsNapWindow } from "@/lib/nap";
import { distanceKm } from "@/lib/distance";
import { getRoutingProvider, type DriveTimeResult } from "@/lib/routing";
import { createClient } from "@/lib/supabase/server";
import EventCard from "@/components/EventCard";
import PlaceCard from "@/components/PlaceCard";
import Nav from "@/components/Nav";
import type { FeedEvent, EventComment, Place, PlaceTip, RsvpStatus } from "@/types";

type AttendeeDisplay = { user_id: string; status: RsvpStatus; display_name: string; avatar_color: string };
// public.feed_events already carries content_status/geography_tier/
// experience_type/weather_fit/age_band/location_latitude/
// location_longitude natively (added to the view alongside is_kid_relevant/
// is_suppressed/duplicate_of filtering) -- no intersection type needed.
type TodayEvent = FeedEvent;
type Weather = { temperature: number; apparentTemperature: number; precipitationProbability: number; weatherCode: number };

const PLACE_CONTEXT_COLUMNS = "id, is_enclosed, has_changing_table, nursing_friendly, stroller_accessible, food_onsite, quiet_or_sensory_friendly, parking_notes, best_time_note, typical_crowd_note, what_to_bring, lat, lng";

type EventCardPlace = { is_enclosed: boolean | null; has_changing_table: boolean | null; nursing_friendly: boolean | null; stroller_accessible: boolean | null; food_onsite: boolean | null; quiet_or_sensory_friendly: boolean | null; parking_notes: string | null; best_time_note: string | null; typical_crowd_note: string | null; what_to_bring: string[] };

function todayEventScore(event: TodayEvent, childAgeMonths: number | null, weather: Weather | null) {
  let score = 0;
  if (event.content_status === "keep") score += 20;
  if (event.geography_tier === "pasco") score += 12;
  if (event.geography_tier === "tampa") score += 4;
  if (childAgeMonths != null) {
    const min = event.age_min_months ?? 0;
    const max = event.age_max_months ?? 120;
    if (childAgeMonths >= min && childAgeMonths <= max) score += 35;
    else if (childAgeMonths >= min - 6 && childAgeMonths <= max + 6) score += 10;
    else score -= 30;
  }
  const experienceBoosts: Record<string, number> = { community_helper: 24, animal: 22, vehicle: 22, storytime_experience: 20, sensory: 18, hands_on: 18, music_movement: 15, general: 0 };
  score += experienceBoosts[event.experience_type ?? "general"] ?? 0;
  if (weather) {
    const wet = weather.precipitationProbability >= 60 || weather.weatherCode >= 80;
    const hot = weather.apparentTemperature >= 92;
    const warm = weather.apparentTemperature >= 86;
    if (event.weather_fit === "indoor" && (wet || hot)) score += 18;
    if (event.weather_fit === "water" && hot) score += 14;
    if (event.weather_fit === "outdoor" && wet) score -= 18;
    if (event.weather_fit === "outdoor" && hot) score -= 8;
    if (event.weather_fit === "outdoor" && warm && !wet) score += 2;
  }
  if (event.registration_required) score -= 2;
  return score;
}

function dedupeTodayEvents(events: TodayEvent[]) {
  const seen = new Set<string>();
  const result: TodayEvent[] = [];
  for (const event of events) {
    const title = event.title.toLowerCase().replace(/session\s*\d+/g, "").replace(/\s+/g, " ").trim();
    const key = `${event.place_id ?? event.venue ?? ""}|${title}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(event);
  }
  return result;
}

async function getWeatherAtLocation(location: { lat: number; lng: number }, eventStart: string): Promise<Weather | null> {
  try {
    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.searchParams.set("latitude", String(location.lat));
    url.searchParams.set("longitude", String(location.lng));
    url.searchParams.set("hourly", "temperature_2m,apparent_temperature,precipitation_probability,weather_code");
    url.searchParams.set("temperature_unit", "fahrenheit");
    url.searchParams.set("timezone", "America/New_York");
    url.searchParams.set("forecast_days", "2");
    const response = await fetch(url, { next: { revalidate: 1800 } });
    if (!response.ok) return null;
    const data = await response.json();
    const eventDate = new Date(eventStart);
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hour12: false }).formatToParts(eventDate);
    const part = (name: string) => parts.find((p) => p.type === name)?.value ?? "";
    const target = `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:00`;
    const index = Array.isArray(data.hourly?.time) ? data.hourly.time.findIndex((t: string) => t === target) : -1;
    if (index < 0) return null;
    return {
      temperature: Number(data.hourly.temperature_2m[index]),
      apparentTemperature: Number(data.hourly.apparent_temperature[index]),
      precipitationProbability: Number(data.hourly.precipitation_probability[index] ?? 0),
      weatherCode: Number(data.hourly.weather_code[index] ?? 0),
    };
  } catch {
    return null;
  }
}

function weatherSummary(weather: Weather) {
  const wet = weather.precipitationProbability >= 60 || weather.weatherCode >= 80;
  const hot = weather.apparentTemperature >= 92;
  if (wet) return `🌧️ ${weather.precipitationProbability}% rain around then`;
  if (hot) return `🔥 Feels like ${Math.round(weather.apparentTemperature)}°`;
  return `☀️ ${Math.round(weather.temperature)}° around then`;
}

export default async function TodayPage(props: PageProps<"/today">) {
  const searchParams = await props.searchParams;
  const requestedGroup = typeof searchParams.group === "string" ? searchParams.group : undefined;
  const paramError = typeof searchParams.error === "string" ? searchParams.error : undefined;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: myProfile } = await supabase.from("profiles").select("display_name, nap_start, nap_end, home_lat, home_lng, child_age_months").eq("id", user.id).maybeSingle();
  const currentUserName = myProfile?.display_name ?? "You";
  const home = myProfile?.home_lat != null && myProfile?.home_lng != null ? { lat: myProfile.home_lat, lng: myProfile.home_lng } : null;

  const { data: groups } = await supabase.from("groups").select("id, name").order("created_at", { ascending: true });
  const groupList = groups ?? [];
  const activeGroupId = (requestedGroup && groupList.some((g) => g.id === requestedGroup) ? requestedGroup : groupList[0]?.id) ?? null;
  const activeGroupName = groupList.find((g) => g.id === activeGroupId)?.name ?? null;

  let activeGroupMemberIds: string[] = [];
  if (activeGroupId) {
    const { data: members } = await supabase.from("group_members").select("user_id").eq("group_id", activeGroupId);
    activeGroupMemberIds = (members ?? []).map((m) => m.user_id);
  }

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(todayStart); todayEnd.setDate(todayEnd.getDate() + 1);
  // public.feed_events already applies status='published' AND
  // is_kid_relevant AND NOT is_suppressed AND duplicate_of IS NULL --
  // content_status is NOT used as a hard filter here (confirmed against
  // real data: filtering on content_status='keep' alone would drop 186
  // real kid-relevant 'review'-status events; is_kid_relevant is the
  // canonical signal, content_status is a looser triage tag) -- it's
  // still used below as one input to todayEventScore's ranking, just not
  // as an exclusion filter.
  const { data: events } = await supabase.from("feed_events").select("*").gte("ends_at", now.toISOString()).lt("starts_at", todayEnd.toISOString()).order("starts_at", { ascending: true });
  const rawEventList = (events ?? []) as TodayEvent[];

  const placeIdsForEvents = [...new Set(rawEventList.map((e) => e.place_id).filter((id): id is string => Boolean(id)))];
  const { data: eventPlaces } = placeIdsForEvents.length ? await supabase.from("places").select(PLACE_CONTEXT_COLUMNS).in("id", placeIdsForEvents) : { data: [] };
  const eventPlaceById = new Map((eventPlaces ?? []).map((p) => [p.id, p as Partial<Place>]));

  const weatherByEventId = new Map<string, Weather | null>();
  await Promise.all(rawEventList.map(async (event) => {
    const lat = event.lat ?? (event.place_id ? eventPlaceById.get(event.place_id)?.lat : null);
    const lng = event.lng ?? (event.place_id ? eventPlaceById.get(event.place_id)?.lng : null);
    if (lat == null || lng == null) { weatherByEventId.set(event.id, null); return; }
    weatherByEventId.set(event.id, await getWeatherAtLocation({ lat, lng }, event.starts_at));
  }));

  const rawRanked = [...rawEventList].sort((a, b) => todayEventScore(b, myProfile?.child_age_months ?? null, weatherByEventId.get(b.id) ?? null) - todayEventScore(a, myProfile?.child_age_months ?? null, weatherByEventId.get(a.id) ?? null));
  const eventList = dedupeTodayEvents(rawRanked).slice(0, 6);
  const eventIds = eventList.map((e) => e.id);

  const { data: rsvps } = eventIds.length ? await supabase.from("rsvps").select("event_id, user_id, status, note").in("event_id", eventIds) : { data: [] };
  const rsvpRows = rsvps ?? [];
  const myRsvpByEvent: Record<string, RsvpStatus> = {}; const myNoteByEvent: Record<string, string | null> = {};
  for (const r of rsvpRows) if (r.user_id === user.id) { myRsvpByEvent[r.event_id] = r.status as RsvpStatus; myNoteByEvent[r.event_id] = r.note ?? null; }
  const scopedRsvpRows = rsvpRows.filter((r) => activeGroupMemberIds.includes(r.user_id));

  const { data: comments } = activeGroupId && eventIds.length ? await supabase.from("event_comments").select("*").eq("group_id", activeGroupId).in("event_id", eventIds).order("created_at", { ascending: true }) : { data: [] };
  const commentRows = (comments ?? []) as EventComment[];
  const todayPlaceIds = [...new Set(eventList.map((e) => e.place_id).filter((id): id is string => Boolean(id)))];
  const eventIdsWithoutPlace = eventList.filter((e) => !e.place_id).map((e) => e.id);
  const [{ data: tipsByPlace }, { data: tipsByEvent }] = await Promise.all([
    activeGroupId && todayPlaceIds.length ? supabase.from("place_tips").select("*").eq("group_id", activeGroupId).in("place_id", todayPlaceIds) : Promise.resolve({ data: [] as PlaceTip[] }),
    activeGroupId && eventIdsWithoutPlace.length ? supabase.from("place_tips").select("*").eq("group_id", activeGroupId).in("event_id", eventIdsWithoutPlace) : Promise.resolve({ data: [] as PlaceTip[] }),
  ]);
  const eventTipRows = [...(tipsByPlace ?? []), ...(tipsByEvent ?? [])] as PlaceTip[];

  const proposerIds = eventList.filter((e) => e.proposed_by_group && e.added_by).map((e) => e.added_by as string);
  const profileIds = [...new Set([...activeGroupMemberIds, ...scopedRsvpRows.map((r) => r.user_id), ...proposerIds, ...commentRows.map((c) => c.user_id), ...eventTipRows.map((t) => t.user_id)])];
  const { data: profiles } = profileIds.length ? await supabase.from("profiles").select("id, display_name, avatar_color").in("id", profileIds) : { data: [] };
  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));
  const roster = Object.fromEntries(activeGroupMemberIds.map((id) => [id, { display_name: profileById.get(id)?.display_name ?? "Someone", avatar_color: profileById.get(id)?.avatar_color ?? "#C0356E" }]));
  const rsvpsByEvent: Record<string, AttendeeDisplay[]> = {};
  for (const r of scopedRsvpRows) { const profile = profileById.get(r.user_id); const list = rsvpsByEvent[r.event_id] ?? []; list.push({ user_id: r.user_id, status: r.status as RsvpStatus, display_name: profile?.display_name ?? "Unknown", avatar_color: profile?.avatar_color ?? "#C0356E" }); rsvpsByEvent[r.event_id] = list; }
  const commentsByEvent: Record<string, (EventComment & { display_name: string })[]> = {};
  for (const c of commentRows) { const list = commentsByEvent[c.event_id] ?? []; list.push({ ...c, display_name: profileById.get(c.user_id)?.display_name ?? "Someone" }); commentsByEvent[c.event_id] = list; }
  const eventTipsByPlaceId: Record<string, (PlaceTip & { display_name: string })[]> = {}; const eventTipsByEventId: Record<string, (PlaceTip & { display_name: string })[]> = {};
  for (const t of eventTipRows) { const display = { ...t, display_name: profileById.get(t.user_id)?.display_name ?? "Someone" }; if (t.place_id) { const list = eventTipsByPlaceId[t.place_id] ?? []; list.push(display); eventTipsByPlaceId[t.place_id] = list; } else if (t.event_id) { const list = eventTipsByEventId[t.event_id] ?? []; list.push(display); eventTipsByEventId[t.event_id] = list; } }

  const { data: places } = await supabase.from("places").select("*").eq("active", true).order("name", { ascending: true });
  let placeList = (places ?? []) as Place[];
  const straightLineByPlaceId = new Map<string, number>();
  if (home) for (const p of placeList) if (p.lat != null && p.lng != null) straightLineByPlaceId.set(p.id, distanceKm(home.lat, home.lng, p.lat, p.lng));
  const driveTimeByPlaceId = new Map<string, DriveTimeResult>();
  if (home) { const routingProvider = getRoutingProvider(); if (routingProvider) { const geolocated = placeList.filter((p) => p.lat != null && p.lng != null); const results = await routingProvider.getDriveTimes(home, geolocated.map((p) => ({ lat: p.lat as number, lng: p.lng as number }))); if (results) geolocated.forEach((p, i) => { const result = results[i]; if (result) driveTimeByPlaceId.set(p.id, result); }); } }
  if (home) placeList = [...placeList].sort((a, b) => { const aKey = driveTimeByPlaceId.get(a.id)?.durationMinutes ?? straightLineByPlaceId.get(a.id); const bKey = driveTimeByPlaceId.get(b.id)?.durationMinutes ?? straightLineByPlaceId.get(b.id); if (aKey == null) return 1; if (bKey == null) return -1; return aKey - bKey; });
  const placeIds = placeList.map((p) => p.id);
  const { data: placeTips } = activeGroupId && placeIds.length ? await supabase.from("place_tips").select("*").eq("group_id", activeGroupId).in("place_id", placeIds) : { data: [] };
  const placeTipsByPlaceId: Record<string, (PlaceTip & { display_name: string })[]> = {};
  for (const t of (placeTips ?? []) as PlaceTip[]) { if (!t.place_id) continue; const list = placeTipsByPlaceId[t.place_id] ?? []; list.push({ ...t, display_name: profileById.get(t.user_id)?.display_name ?? "Someone" }); placeTipsByPlaceId[t.place_id] = list; }

  const todayLabel = todayStart.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
  return (
    <div className="flex flex-1 flex-col items-center px-4 py-10">
      <div className="w-full max-w-2xl">
        <Nav email={user.email ?? ""} />
        <h1 className="mb-1 text-xl font-bold text-zinc-900">Today</h1>
        <p className="mb-6 text-sm text-zinc-500">{todayLabel}</p>
        {paramError && <p className="mb-6 text-sm text-red-600">{paramError}</p>}
        {groupList.length > 1 && <div className="mb-6 flex flex-wrap items-center gap-2 text-sm"><span className="text-zinc-500">Group:</span>{groupList.map((g) => <a key={g.id} href={`/today?group=${g.id}`} className={g.id === activeGroupId ? "rounded-full bg-zinc-900 px-3 py-1 font-medium text-white" : "rounded-full border border-zinc-300 px-3 py-1 text-zinc-700 hover:border-zinc-500"}>{g.name}</a>)}</div>}
        {!home && <p className="mb-6 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">Set your home location in <a href="/settings" className="underline">Settings</a> to see how far places are from you.</p>}
        <section className="mb-8">
          <div className="mb-3 flex items-end justify-between gap-4"><div><h2 className="text-base font-semibold text-zinc-900">Good options for today</h2><p className="mt-1 text-xs text-zinc-500">A few picks, not a calendar.</p></div><a href="/calendar" className="text-xs font-medium text-zinc-600 underline underline-offset-2">See all</a></div>
          {eventList.length === 0 ? <p className="rounded-xl border border-dashed border-zinc-200 px-4 py-5 text-sm text-zinc-500">Nothing scheduled for the rest of today — here are some ideas instead.</p> : <div className="flex flex-col gap-4">{eventList.map((event) => { const proposedBy = event.proposed_by_group && event.added_by ? { user_id: event.added_by, display_name: profileById.get(event.added_by)?.display_name ?? "Someone" } : null; const place = event.place_id ? (eventPlaceById.get(event.place_id) ?? null) : null; const duringNap = overlapsNapWindow(event.starts_at, event.ends_at, myProfile?.nap_start ?? null, myProfile?.nap_end ?? null); const tips = event.place_id ? (eventTipsByPlaceId[event.place_id] ?? []) : (eventTipsByEventId[event.id] ?? []); const eventWeather = weatherByEventId.get(event.id) ?? null; return <div key={event.id} className="flex flex-col gap-2">{eventWeather && <div className="px-1 text-xs font-medium text-zinc-600">{weatherSummary(eventWeather)}</div>}<EventCard event={event} currentUserId={user.id} currentUserName={currentUserName} currentStatus={myRsvpByEvent[event.id] ?? null} currentNote={myNoteByEvent[event.id] ?? null} attendees={rsvpsByEvent[event.id] ?? []} hasActiveGroup={Boolean(activeGroupId)} activeGroupId={activeGroupId} activeGroupName={activeGroupName} activeGroupMemberIds={activeGroupMemberIds} roster={roster} proposedBy={proposedBy} place={place as EventCardPlace | null} duringNap={duringNap} comments={commentsByEvent[event.id] ?? []} tips={tips} childAgeMonths={myProfile?.child_age_months ?? null} /></div>; })}</div>}
        </section>
        <section><h2 className="mb-3 text-sm font-semibold text-zinc-700">Good options for your family</h2>{placeList.length === 0 ? <p className="text-sm text-zinc-400">No curated places yet in your market.</p> : <div className="flex flex-col gap-4">{placeList.map((place) => <PlaceCard key={place.id} place={place} groupId={activeGroupId} groupName={activeGroupName} currentUserId={user.id} tips={placeTipsByPlaceId[place.id] ?? []} distance={straightLineByPlaceId.has(place.id) ? { km: straightLineByPlaceId.get(place.id)!, driveMinutes: driveTimeByPlaceId.get(place.id)?.durationMinutes } : undefined} childAgeMonths={myProfile?.child_age_months ?? null} />)}</div>}</section>
      </div>
    </div>
  );
}
