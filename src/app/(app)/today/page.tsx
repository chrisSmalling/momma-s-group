import { redirect } from "next/navigation";
import { after } from "next/server";
import { applyAgeGate } from "@/lib/ageGate";
import { overlapsNapWindow } from "@/lib/nap";
import { distanceKm } from "@/lib/distance";
import { createClient } from "@/lib/supabase/server";
import TodayFeed, { type EventBundle } from "@/components/TodayFeed";
import PlaceCard from "@/components/PlaceCard";
import PoppyTodayEntry from "@/components/poppy/PoppyTodayEntry";
import Nav from "@/components/Nav";
import HomeAddressNudge from "@/components/HomeAddressNudge";
import { deriveHomeStatus } from "@/lib/homeStatus";
import { scorePlace } from "@/lib/recommend/score";
import { easternDateKey } from "@/lib/recommend/filter";
import { exposurePenalty, nextExposureState, type ExposureState } from "@/lib/recommend/exposure";
import type { PoppyProfile, RecommendationConstraints } from "@/lib/recommend/types";
import type { FeedEvent, EventComment, Place, PlaceTip, RsvpStatus } from "@/types";

type AttendeeDisplay = { user_id: string; status: RsvpStatus; display_name: string; avatar_color: string };
type TodayEvent = FeedEvent;

const PLACE_CONTEXT_COLUMNS = "id, is_enclosed, has_changing_table, nursing_friendly, stroller_accessible, food_onsite, quiet_or_sensory_friendly, parking_notes, best_time_note, typical_crowd_note, what_to_bring, lat, lng";
const CANDIDATE_POOL_SIZE = 12;

function todayEventScore(event: TodayEvent, childAgeMonths: number | null) {
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

function firstName(displayName: string | null | undefined) { const trimmed = (displayName ?? "").trim(); return trimmed ? trimmed.split(/\s+/)[0] : null; }
function greeting(now: Date) { const hour = now.getHours(); if (hour < 12) return { text: "Good morning", emoji: "☀️" }; if (hour < 17) return { text: "Good afternoon", emoji: "🌤️" }; return { text: "Good evening", emoji: "🌙" }; }

export default async function TodayPage(props: PageProps<"/today">) {
  const searchParams = await props.searchParams;
  const requestedGroup = typeof searchParams.group === "string" ? searchParams.group : undefined;
  const paramError = typeof searchParams.error === "string" ? searchParams.error : undefined;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: myProfile } = await supabase.from("profiles").select("display_name, nap_start, nap_end, home_address, home_lat, home_lng, child_age_months, child_name").eq("id", user.id).maybeSingle();
  const currentUserName = myProfile?.display_name ?? "You";
  const home = myProfile?.home_lat != null && myProfile?.home_lng != null ? { lat: myProfile.home_lat, lng: myProfile.home_lng } : null;
  const homeStatus = deriveHomeStatus(myProfile?.home_address, myProfile?.home_lat, myProfile?.home_lng);
  const { data: groups } = await supabase.from("groups").select("id, name").order("created_at", { ascending: true });
  const groupList = groups ?? [];
  const activeGroupId = (requestedGroup && groupList.some((g) => g.id === requestedGroup) ? requestedGroup : groupList[0]?.id) ?? null;
  const activeGroupName = groupList.find((g) => g.id === activeGroupId)?.name ?? null;
  let activeGroupMemberIds: string[] = [];
  if (activeGroupId) { const { data: members } = await supabase.from("group_members").select("user_id").eq("group_id", activeGroupId); activeGroupMemberIds = (members ?? []).map((m) => m.user_id); }

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(todayStart); todayEnd.setDate(todayEnd.getDate() + 1);
  const { data: events } = await supabase.from("feed_events").select("*").gte("ends_at", now.toISOString()).lt("starts_at", todayEnd.toISOString()).order("starts_at", { ascending: true });
  // Hard toddler age-fit gate (src/lib/ageGate.ts) -- the same one every
  // other surface applies (search, Poppy, calendar). feed_events is
  // kid-relevant in general but says nothing about THIS child's age.
  const rawEventList = applyAgeGate((events ?? []) as TodayEvent[], myProfile?.child_age_months ?? null);
  const placeIdsForEvents = [...new Set(rawEventList.map((e) => e.place_id).filter((id): id is string => Boolean(id)))];
  const { data: eventPlaces } = placeIdsForEvents.length ? await supabase.from("places").select(PLACE_CONTEXT_COLUMNS).in("id", placeIdsForEvents) : { data: [] };
  const eventPlaceById = new Map((eventPlaces ?? []).map((p) => [p.id, p as Partial<Place>]));
  const rawRanked = [...rawEventList].sort((a, b) => todayEventScore(b, myProfile?.child_age_months ?? null) - todayEventScore(a, myProfile?.child_age_months ?? null));
  const eventList = dedupeTodayEvents(rawRanked).slice(0, CANDIDATE_POOL_SIZE);
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
  const eventDistanceById = new Map<string, { km: number }>();
  if (home) for (const event of eventList) { const lat = event.lat ?? (event.place_id ? eventPlaceById.get(event.place_id)?.lat : null); const lng = event.lng ?? (event.place_id ? eventPlaceById.get(event.place_id)?.lng : null); if (lat != null && lng != null) eventDistanceById.set(event.id, { km: distanceKm(home.lat, home.lng, lat, lng) }); }
  const eventBundles: EventBundle[] = eventList.map((event) => { const proposedBy = event.proposed_by_group && event.added_by ? { user_id: event.added_by, display_name: profileById.get(event.added_by)?.display_name ?? "Someone" } : null; const place = event.place_id ? (eventPlaceById.get(event.place_id) ?? null) : null; const duringNap = overlapsNapWindow(event.starts_at, event.ends_at, myProfile?.nap_start ?? null, myProfile?.nap_end ?? null); const tips = event.place_id ? (eventTipsByPlaceId[event.place_id] ?? []) : (eventTipsByEventId[event.id] ?? []); return { event, currentStatus: myRsvpByEvent[event.id] ?? null, currentNote: myNoteByEvent[event.id] ?? null, proposedBy, place: place as EventBundle["place"], duringNap, tips, comments: commentsByEvent[event.id] ?? [], attendees: rsvpsByEvent[event.id] ?? [], weatherSummary: null, distance: eventDistanceById.get(event.id) }; });

  const { data: places } = await supabase.from("places").select("*").eq("active", true).order("name", { ascending: true });
  // Same hard age-fit gate as everywhere else. This list bypasses
  // search_places/searchPlaces() (it's queried directly for the "Today"
  // ranking below), so it needs its own call rather than inheriting one.
  let placeList = applyAgeGate((places ?? []) as Place[], myProfile?.child_age_months ?? null);
  const todayCandidateLimit = 24;
  const todayDisplayLimit = 5;
  const straightLineByPlaceId = new Map<string, number>();
  if (home) for (const p of placeList) if (p.lat != null && p.lng != null) straightLineByPlaceId.set(p.id, distanceKm(home.lat, home.lng, p.lat, p.lng));
  const todayPlaceCandidates = home ? [...placeList].sort((a, b) => { const aKey = straightLineByPlaceId.get(a.id); const bKey = straightLineByPlaceId.get(b.id); if (aKey == null) return 1; if (bKey == null) return -1; return aKey - bKey; }).slice(0, todayCandidateLimit) : placeList.slice(0, todayCandidateLimit);
  // Drive time is intentionally excluded from the initial Today render. Straight-line
  // distance is sufficient for the first paint; drive-time enrichment can be added later.
  const todayDateKey = easternDateKey(now);
  const candidateIds = todayPlaceCandidates.map((p) => p.id);
  const { data: exposureRows } = candidateIds.length ? await supabase.from("place_exposure").select("place_id, last_shown_at, consecutive_days").eq("user_id", user.id).in("place_id", candidateIds) : { data: [] };
  const exposureByPlaceId = new Map<string, ExposureState>((exposureRows ?? []).map((r) => [r.place_id, { lastShownAt: r.last_shown_at, consecutiveDays: r.consecutive_days }]));
  const todayProfile: PoppyProfile = { childAgeMonths: myProfile?.child_age_months ?? null, childInterests: [], childActivityPreferences: [], preferredCategories: [], preferredPlaceTypes: [], indoorPreference: "either", maxDistanceMiles: null, familyBudgetNote: null, napStart: myProfile?.nap_start ?? null, napEnd: myProfile?.nap_end ?? null, homeLat: myProfile?.home_lat ?? null, homeLng: myProfile?.home_lng ?? null };
  const todayConstraints: RecommendationConstraints = { mood: "all", indoor: "either", indoorExplicit: false, budget: "any", maxMiles: null, timeframe: "any", timeOfDay: "any" };
  const rankedPlaceCandidates = todayPlaceCandidates.map((p) => {
    const km = straightLineByPlaceId.get(p.id);
    const miles = km != null ? km * 0.621371 : null;
    const relevance = scorePlace(p, miles, todayConstraints, todayProfile, null);
    const penalty = exposurePenalty(exposureByPlaceId.get(p.id) ?? null, todayDateKey);
    return { place: p, finalScore: relevance - penalty };
  }).sort((a, b) => b.finalScore - a.finalScore);
  placeList = rankedPlaceCandidates.slice(0, todayDisplayLimit).map((r) => r.place);

  // Record today's showing after the response is sent — a concurrent perf
  // pass dropped this write outright while removing the render-blocking
  // weather/routing calls nearby, which silently froze the Phase 2 rotation
  // mechanism (exposureByPlaceId would never advance past whatever was last
  // recorded). after() keeps the actual page render non-blocking while
  // still updating place_exposure for tomorrow's ranking.
  if (placeList.length) {
    const upserts = placeList.map((p) => {
      const next = nextExposureState(exposureByPlaceId.get(p.id) ?? null, todayDateKey);
      return { user_id: user.id, place_id: p.id, last_shown_at: next.lastShownAt, consecutive_days: next.consecutiveDays };
    });
    after(async () => {
      const { error: exposureError } = await supabase.from("place_exposure").upsert(upserts, { onConflict: "user_id,place_id" });
      if (exposureError) console.error("[today] place exposure upsert failed", exposureError.message);
    });
  }

  const placeIds = placeList.map((p) => p.id);
  const { data: placeTips } = activeGroupId && placeIds.length ? await supabase.from("place_tips").select("*").eq("group_id", activeGroupId).in("place_id", placeIds) : { data: [] };
  const placeTipsByPlaceId: Record<string, (PlaceTip & { display_name: string })[]> = {};
  for (const t of (placeTips ?? []) as PlaceTip[]) { if (!t.place_id) continue; const list = placeTipsByPlaceId[t.place_id] ?? []; list.push({ ...t, display_name: profileById.get(t.user_id)?.display_name ?? "Someone" }); placeTipsByPlaceId[t.place_id] = list; }
  const todayLabel = todayStart.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
  const { text: greetingText, emoji: greetingEmoji } = greeting(now);
  const name = firstName(myProfile?.display_name);

  return (
    <div className="flex flex-1 flex-col items-center px-4 py-10">
      <div className="w-full max-w-2xl">
        <Nav email={user.email ?? ""} />
        <h1 className="font-display mb-1 text-2xl font-bold text-zinc-900">{greetingText}{name ? `, ${name}` : ""} {greetingEmoji}</h1>
        <p className="mb-6 text-sm text-zinc-500">{todayLabel}</p>
        {paramError && <p className="mb-6 text-sm text-red-600">{paramError}</p>}
        {groupList.length > 1 && <div className="mb-6 flex flex-wrap items-center gap-2 text-sm"><span className="text-zinc-500">Group:</span>{groupList.map((g) => <a key={g.id} href={`/today?group=${g.id}`} className={g.id === activeGroupId ? "rounded-full bg-zinc-900 px-3 py-1 font-medium text-white" : "rounded-full border border-zinc-300 px-3 py-1 text-zinc-700 hover:border-zinc-500"}>{g.name}</a>)}</div>}
        <HomeAddressNudge status={homeStatus} purpose="see how far places are from you" />
        <div className="mb-6"><PoppyTodayEntry childName={myProfile?.child_name?.trim() ? myProfile.child_name.trim() : null} /></div>
        <section className="mb-8"><div className="mb-3 flex items-end justify-between gap-4"><div><h2 className="font-display text-lg font-bold text-zinc-900">Happening today</h2><p className="mt-1 text-xs text-zinc-500">A few picks, not a calendar.</p></div><a href="/calendar" className="text-xs font-medium text-zinc-600 underline underline-offset-2">See all</a></div><TodayFeed bundles={eventBundles} currentUserId={user.id} currentUserName={currentUserName} hasActiveGroup={Boolean(activeGroupId)} activeGroupId={activeGroupId} activeGroupName={activeGroupName} activeGroupMemberIds={activeGroupMemberIds} roster={roster} childAgeMonths={myProfile?.child_age_months ?? null} /></section>
        <section><div className="mb-3 flex items-end justify-between gap-4"><div><h2 className="font-display text-lg font-bold text-zinc-900">Good options for your family</h2><p className="mt-1 text-xs text-zinc-500">A few good ideas from Poppy.</p></div><a href="/places" className="rounded-full bg-rose-600 px-3 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-rose-700">Ask Poppy</a></div>{placeList.length === 0 ? <p className="rounded-xl border border-dashed border-zinc-200 px-4 py-5 text-sm text-zinc-500">No curated places yet in your market — check back soon, or ask Poppy for a different plan.</p> : <div className="flex flex-col gap-4">{placeList.map((place) => <PlaceCard key={place.id} place={place} groupId={activeGroupId} groupName={activeGroupName} currentUserId={user.id} tips={placeTipsByPlaceId[place.id] ?? []} distance={straightLineByPlaceId.has(place.id) ? { km: straightLineByPlaceId.get(place.id)! } : undefined} childAgeMonths={myProfile?.child_age_months ?? null} weather={null} />)}</div>}</section>
      </div>
    </div>
  );
}