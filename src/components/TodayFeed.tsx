"use client";

import { useState } from "react";
import EventCard from "@/components/EventCard";
import type { FeedEvent, EventComment, Place, PlaceTip, RsvpStatus } from "@/types";

type Attendee = { user_id: string; status: RsvpStatus; display_name: string; avatar_color: string };
type EventCardPlace = Pick<Place, "is_enclosed" | "has_changing_table" | "nursing_friendly" | "stroller_accessible" | "food_onsite" | "quiet_or_sensory_friendly" | "parking_notes" | "best_time_note" | "typical_crowd_note" | "what_to_bring">;

export type EventBundle = {
  event: FeedEvent;
  currentStatus: RsvpStatus | null;
  currentNote: string | null;
  proposedBy: { user_id: string; display_name: string } | null;
  place: EventCardPlace | null;
  duringNap: boolean;
  tips: (PlaceTip & { display_name: string })[];
  comments: (EventComment & { display_name: string })[];
  attendees: Attendee[];
  weatherSummary: string | null;
  distance?: { km: number; driveMinutes?: number };
};

// Each mood's `match` reads only real fields already on FeedEvent — no
// mood is faked. weather_fit ("indoor" | "outdoor" | "water") and
// experience_type (community_helper | animal | vehicle |
// storytime_experience | sensory | hands_on | music_movement | general)
// are the same real enum fields the server's ranking already reads
// (see todayEventScore in the page). "Play" and "Learn" are a judgment
// call grouping existing experience_type values, not a new field.
const MOODS: { id: string; label: string; match: (e: FeedEvent) => boolean }[] = [
  { id: "all", label: "All", match: () => true },
  { id: "play", label: "Play", match: (e) => e.experience_type === "hands_on" || e.experience_type === "music_movement" },
  { id: "learn", label: "Learn", match: (e) => e.experience_type === "storytime_experience" || e.experience_type === "community_helper" },
  { id: "indoor", label: "Indoor", match: (e) => e.is_outdoor === false },
  { id: "outside", label: "Outside", match: (e) => e.is_outdoor === true },
  { id: "water", label: "Water", match: (e) => e.weather_fit === "water" },
  { id: "calm", label: "Calm", match: (e) => e.experience_type === "sensory" },
];

export default function TodayFeed({
  bundles,
  currentUserId,
  currentUserName,
  hasActiveGroup,
  activeGroupId,
  activeGroupName,
  activeGroupMemberIds,
  roster,
  childAgeMonths,
}: {
  bundles: EventBundle[];
  currentUserId: string;
  currentUserName: string;
  hasActiveGroup: boolean;
  activeGroupId: string | null;
  activeGroupName: string | null;
  activeGroupMemberIds: string[];
  roster: Record<string, { display_name: string; avatar_color: string }>;
  childAgeMonths?: number | null;
}) {
  // Disable (don't render as a live filter) a mood with zero matches in
  // today's actual pool, rather than showing a chip that always empties
  // the feed.
  const availableMoods = MOODS.filter((mood) => mood.id === "all" || bundles.some((b) => mood.match(b.event)));
  const [selectedMood, setSelectedMood] = useState("all");
  const activeMood = availableMoods.find((m) => m.id === selectedMood) ?? availableMoods[0];
  const visible = bundles.filter((b) => activeMood.match(b.event));

  return (
    <>
      <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1" role="tablist" aria-label="Filter by mood">
        {availableMoods.map((mood) => {
          const active = mood.id === activeMood.id;
          return (
            <button
              key={mood.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setSelectedMood(mood.id)}
              className={
                active
                  ? "min-h-11 shrink-0 rounded-full bg-rose-600 px-4 py-2 text-sm font-bold text-white"
                  : "min-h-11 shrink-0 rounded-full border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 hover:border-zinc-400"
              }
            >
              {mood.label}
            </button>
          );
        })}
      </div>

      {visible.length === 0 ? (
        <p className="rounded-xl border border-dashed border-zinc-200 px-4 py-5 text-sm text-zinc-500">
          Nothing scheduled today matches &ldquo;{activeMood.label}&rdquo; — peek at Explore, or ask your group what they&apos;re up to.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {visible.map((b) => (
            <div key={b.event.id}>
              <EventCard
                event={b.event}
                currentUserId={currentUserId}
                currentUserName={currentUserName}
                currentStatus={b.currentStatus}
                currentNote={b.currentNote}
                attendees={b.attendees}
                hasActiveGroup={hasActiveGroup}
                activeGroupId={activeGroupId}
                activeGroupName={activeGroupName}
                activeGroupMemberIds={activeGroupMemberIds}
                roster={roster}
                proposedBy={b.proposedBy}
                place={b.place}
                duringNap={b.duringNap}
                comments={b.comments}
                tips={b.tips}
                childAgeMonths={childAgeMonths}
                distance={b.distance}
                weatherSummary={b.weatherSummary}
              />
            </div>
          ))}
        </div>
      )}
    </>
  );
}
