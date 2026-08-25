"use client";

import { useMemo, useState } from "react";
import EventCard from "@/components/EventCard";
import type { FeedEvent, EventComment, Place, PlaceTip, RsvpStatus } from "@/types";

type Attendee = { user_id: string; status: RsvpStatus; display_name: string; avatar_color: string };
type EventCardPlace = Pick<Place, "is_enclosed" | "has_changing_table" | "nursing_friendly" | "stroller_accessible" | "food_onsite" | "quiet_or_sensory_friendly" | "parking_notes" | "best_time_note" | "typical_crowd_note" | "what_to_bring">;
export type EventBundle = { event: FeedEvent; currentStatus: RsvpStatus | null; currentNote: string | null; proposedBy: { user_id: string; display_name: string } | null; place: EventCardPlace | null; duringNap: boolean; tips: (PlaceTip & { display_name: string })[]; comments: (EventComment & { display_name: string })[]; attendees: Attendee[]; weatherSummary: string | null; distance?: { km: number; driveMinutes?: number } };
type FeedFilter = { id: string; label: string; match: (bundle: EventBundle) => boolean };

const MOODS: FeedFilter[] = [
  { id: "all", label: "All", match: () => true },
  { id: "play", label: "Play", match: (b) => b.event.experience_type === "hands_on" || b.event.experience_type === "music_movement" },
  { id: "learn", label: "Learn", match: (b) => b.event.experience_type === "storytime_experience" || b.event.experience_type === "community_helper" },
  { id: "indoor", label: "Indoor", match: (b) => b.event.is_outdoor === false },
  { id: "outside", label: "Outside", match: (b) => b.event.is_outdoor === true },
  { id: "water", label: "Water", match: (b) => b.event.weather_fit === "water" },
  { id: "calm", label: "Calm", match: (b) => b.event.experience_type === "sensory" },
];

export default function TodayFeed({ bundles, currentUserId, currentUserName, hasActiveGroup, activeGroupId, activeGroupName, activeGroupMemberIds, roster, childAgeMonths }: { bundles: EventBundle[]; currentUserId: string; currentUserName: string; hasActiveGroup: boolean; activeGroupId: string | null; activeGroupName: string | null; activeGroupMemberIds: string[]; roster: Record<string, { display_name: string; avatar_color: string }>; childAgeMonths?: number | null }) {
  const [selectedFilter, setSelectedFilter] = useState("all");
  const [expanded, setExpanded] = useState(false);
  const filters = useMemo<FeedFilter[]>(() => {
    const base = MOODS.filter((f) => f.id === "all" || bundles.some(f.match));
    const extras: FeedFilter[] = [];
    if (bundles.some((b) => b.distance != null && b.distance.km <= 8)) extras.push({ id: "nearby", label: "Nearby", match: (b) => b.distance != null && b.distance.km <= 8 });
    if (hasActiveGroup && bundles.some((b) => b.attendees.some((a) => activeGroupMemberIds.includes(a.user_id) && a.status === "going"))) extras.push({ id: "friends", label: "Friends going", match: (b) => b.attendees.some((a) => activeGroupMemberIds.includes(a.user_id) && a.status === "going") });
    if (bundles.some((b) => b.currentStatus === "going")) extras.push({ id: "mine", label: "I'm going", match: (b) => b.currentStatus === "going" });
    return [...base, ...extras];
  }, [bundles, hasActiveGroup, activeGroupMemberIds]);
  const activeFilter = filters.find((f) => f.id === selectedFilter) ?? filters[0];
  const visible = bundles.filter(activeFilter.match);
  const shown = expanded ? visible : visible.slice(0, 5);
  const hasMore = visible.length > 5;

  return <>
    <div className="-mx-4 mb-5 overflow-x-auto px-4 pb-1" role="tablist" aria-label="Today filters">
      <div className="flex min-w-max gap-2">
        {filters.map((filter) => { const active = filter.id === activeFilter.id; return <button key={filter.id} type="button" role="tab" aria-selected={active} onClick={() => { setSelectedFilter(filter.id); setExpanded(false); }} className={active ? "min-h-11 shrink-0 rounded-full bg-rose-600 px-4 py-2 text-sm font-bold text-white" : "min-h-11 shrink-0 rounded-full border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 hover:border-zinc-400"}>{filter.label}</button>; })}
      </div>
    </div>

    {visible.length === 0 ? <div className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 px-4 py-6 text-sm text-zinc-600">Nothing today matches <strong>{activeFilter.label}</strong>. Try another filter or ask Explorer for a different plan.</div> : <>
      <div className="mb-3 flex items-center justify-between gap-3"><div><h3 className="font-display text-lg font-bold text-zinc-950">Today&apos;s best bets</h3><p className="text-xs text-zinc-500">A short list first — more only when you ask for it.</p></div><span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-semibold text-zinc-600">{visible.length} option{visible.length === 1 ? "" : "s"}</span></div>
      <div className="flex flex-col gap-4">
        {shown.map((b) => <div key={b.event.id}><EventCard event={b.event} currentUserId={currentUserId} currentUserName={currentUserName} currentStatus={b.currentStatus} currentNote={b.currentNote} attendees={b.attendees} hasActiveGroup={hasActiveGroup} activeGroupId={activeGroupId} activeGroupName={activeGroupName} activeGroupMemberIds={activeGroupMemberIds} roster={roster} proposedBy={b.proposedBy} place={b.place} duringNap={b.duringNap} comments={b.comments} tips={b.tips} childAgeMonths={childAgeMonths} distance={b.distance} weatherSummary={b.weatherSummary} /></div>)}
      </div>
      {hasMore && <div className="mt-5 flex justify-center"><button type="button" onClick={() => setExpanded((v) => !v)} className="min-h-11 rounded-full border border-zinc-300 bg-white px-5 py-2 text-sm font-bold text-zinc-800 shadow-sm">{expanded ? "Show fewer" : `See all ${visible.length}`}</button></div>}
    </>}
  </>;
}
