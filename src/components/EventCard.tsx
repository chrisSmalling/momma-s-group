import Link from "next/link";
import EventCardShell from "@/components/EventCardShell";
import LiveAttendees from "@/components/LiveAttendees";
import GoingAvatars from "@/components/GoingAvatars";
import PracticalityIcons from "@/components/PracticalityIcons";
import EventComments from "@/components/EventComments";
import TipsSection from "@/components/TipsSection";
import AskGroupButton from "@/components/AskGroupButton";
import GroupAvailability from "@/components/GroupAvailability";
import { isGoodAgeFit, formatAgeRange } from "@/lib/ageFit";
import { isFreeCost } from "@/lib/cost";
import type { FeedEvent, Place, PlaceTip, RsvpStatus, EventComment } from "@/types";

type Attendee = { user_id: string; status: RsvpStatus; display_name: string; avatar_color: string };
type ProposedBy = { user_id: string; display_name: string };
type PlaceContext = Pick<Place, "is_enclosed" | "has_changing_table" | "nursing_friendly" | "stroller_accessible" | "food_onsite" | "quiet_or_sensory_friendly" | "parking_notes" | "best_time_note" | "typical_crowd_note" | "what_to_bring">;
type CommentDisplay = EventComment & { display_name: string };
type TipDisplay = PlaceTip & { display_name: string };

const EVENT_TIME_ZONE = "America/New_York";

function dateBadgeParts(event: FeedEvent) {
  const d = new Date(event.starts_at);
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: EVENT_TIME_ZONE, weekday: "short", day: "numeric" }).formatToParts(d);
  const day = Number(parts.find((p) => p.type === "day")?.value ?? d.getDate());
  const weekday = parts.find((p) => p.type === "weekday")?.value ?? "";
  return { weekday, day };
}

function formatTime(event: FeedEvent) {
  if (event.time_unknown) return "Check times";
  return new Intl.DateTimeFormat("en-US", { timeZone: EVENT_TIME_ZONE, hour: "numeric", minute: "2-digit" }).format(new Date(event.starts_at));
}

function CostPill({ cost }: { cost: string | null }) {
  if (isFreeCost(cost)) return <span className="shrink-0 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-700">Free</span>;
  if (!cost?.trim()) return <span className="shrink-0 rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-semibold text-zinc-600">Cost unknown</span>;
  return <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-800">{cost}</span>;
}

function CancelledPill() {
  return <span className="shrink-0 rounded-full bg-zinc-200 px-2.5 py-1 text-xs font-semibold text-zinc-600">Cancelled</span>;
}

function FitChips({ goodAgeFit, isOutdoor, driveMinutes, registrationRequired }: { goodAgeFit: boolean; isOutdoor: boolean; driveMinutes?: number; registrationRequired: boolean }) {
  const chips: { key: string; label: string; tone: "sage" | "amber" }[] = [];
  if (goodAgeFit) chips.push({ key: "age", label: "👶 Great for their age", tone: "sage" });
  chips.push({ key: "indoor", label: isOutdoor ? "🌳 Outside" : "🏠 Indoor", tone: "sage" });
  if (driveMinutes !== undefined) chips.push({ key: "drive", label: `🚗 ${Math.round(driveMinutes)} min`, tone: "sage" });
  if (registrationRequired) chips.push({ key: "reg", label: "📝 Registration required", tone: "amber" });

  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      {chips.map((chip) => (
        <span key={chip.key} className={chip.tone === "sage" ? "inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700" : "inline-flex items-center rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800"}>{chip.label}</span>
      ))}
    </div>
  );
}

export default function EventCard({ event, currentUserId, currentUserName, currentStatus, currentNote, attendees, hasActiveGroup, activeGroupId, activeGroupName, activeGroupMemberIds, roster, proposedBy, place, duringNap, comments, tips, childAgeMonths, distance, weatherSummary }: {
  event: FeedEvent;
  currentUserId: string;
  currentUserName: string;
  currentStatus: RsvpStatus | null;
  currentNote: string | null;
  attendees: Attendee[];
  hasActiveGroup: boolean;
  activeGroupId: string | null;
  activeGroupName: string | null;
  activeGroupMemberIds: string[];
  roster: Record<string, { display_name: string; avatar_color: string }>;
  proposedBy: ProposedBy | null;
  place: PlaceContext | null;
  duringNap: boolean;
  comments: CommentDisplay[];
  tips: TipDisplay[];
  childAgeMonths?: number | null;
  distance?: { km: number; driveMinutes?: number };
  weatherSummary?: string | null;
}) {
  const { weekday, day } = dateBadgeParts(event);
  const cancelled = event.status === "cancelled";
  const bring = event.what_to_bring.length > 0 ? event.what_to_bring : (place?.what_to_bring ?? []);
  const goodAgeFit = isGoodAgeFit(childAgeMonths, event.age_min_months, event.age_max_months);
  const miles = distance?.km != null ? distance.km * 0.621371 : null;
  // Numeric bounds are the source of truth goodAgeFit itself checks
  // against, so prefer that derived label over the separately-scraped
  // age_tags text — the two can disagree, and only one should reach the
  // viewer. Tags are shown only when there's no numeric range to derive
  // from at all.
  const ageLabel = formatAgeRange(event.age_min_months, event.age_max_months) ?? (event.age_tags.length > 0 ? event.age_tags.join(" · ") : null);
  // Social proof is the hero when it exists (Phase 2 handoff) — shown only
  // when someone's actually going, not the "be the first" negative state,
  // which stays a lower-priority nudge inside LiveAttendees below.
  const heroGoing = attendees.filter((a) => a.status === "going");

  return (
    <EventCardShell
      eventId={event.id}
      currentStatus={currentStatus}
      currentNote={currentNote}
      disabled={cancelled}
      duringNap={duringNap}
      header={<>
        <Link href={`/events/${event.id}`} className="group block rounded-xl -m-1 p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500" aria-label={`View details for ${event.title}`}>
          <div className="flex gap-3">
            <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-2xl bg-rose-50 text-rose-700"><span className="text-[10px] font-bold uppercase tracking-wide">{weekday}</span><span className="text-xl font-bold leading-none">{day}</span></div>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2"><h3 className={cancelled ? "font-display text-xl font-bold leading-tight text-zinc-400 line-through" : "font-display text-xl font-bold leading-tight text-zinc-900 group-hover:text-rose-700"}>{event.title}</h3>{cancelled ? <CancelledPill /> : <CostPill cost={event.cost} />}</div>
              <p className="mt-1 text-sm font-semibold text-zinc-600">{formatTime(event)}</p>
              {event.venue && <p className="mt-0.5 line-clamp-2 text-sm text-zinc-500">{event.venue}{event.room_name ? ` · ${event.room_name}` : ""}</p>}
              {heroGoing.length > 0 && <div className="mt-2"><GoingAvatars going={heroGoing} currentUserId={currentUserId} groupName={activeGroupName} hasActiveGroup={hasActiveGroup} /></div>}
              {ageLabel && <div className="mt-1.5 flex flex-wrap items-center gap-1.5"><span className="inline-block rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-600">{ageLabel}</span></div>}
              {!cancelled && <FitChips goodAgeFit={goodAgeFit} isOutdoor={event.is_outdoor} driveMinutes={distance?.driveMinutes} registrationRequired={event.registration_required} />}
              {!cancelled && (weatherSummary || distance) && <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl bg-zinc-50 px-3 py-2 text-xs font-semibold text-zinc-700 ring-1 ring-zinc-100">{weatherSummary && <span>{weatherSummary}</span>}{distance && <span>🚗 {distance.driveMinutes != null ? `${Math.round(distance.driveMinutes)} min` : "Drive time unavailable"}{miles != null ? ` · ${miles < 10 ? miles.toFixed(1) : Math.round(miles)} mi` : ""}</span>}</div>}
              {proposedBy && <p className="mt-1.5 text-xs italic text-zinc-400">Proposed by {proposedBy.user_id === currentUserId ? "you" : proposedBy.display_name}</p>}
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between border-t border-zinc-100 pt-3"><span className="text-sm font-bold text-rose-700">View full event</span><span aria-hidden="true" className="text-lg font-semibold text-rose-600 transition-transform group-hover:translate-x-0.5">→</span></div>
        </Link>

        {event.registration_required && event.registration_url && <div className="mt-3"><a href={event.registration_url} target="_blank" rel="noopener noreferrer" className="min-h-11 inline-flex items-center text-sm font-semibold text-rose-700 underline underline-offset-2">Register →</a></div>}
      </>}
    >
      <details className="mt-3 rounded-xl border border-zinc-100 bg-zinc-50/70 px-3"><summary className="flex min-h-11 cursor-pointer items-center justify-between text-sm font-bold text-zinc-700"><span>More about this event</span><span aria-hidden="true" className="text-zinc-400">⌄</span></summary><div className="pb-3">
        {bring.length > 0 && <p className="mt-1 text-sm font-semibold text-rose-700">Bring: {bring.join(", ")}</p>}
        {place && <div className="mt-3 flex flex-col gap-1.5"><PracticalityIcons practicalities={place} />{place.parking_notes && <p className="text-xs text-zinc-500"><span className="font-medium text-zinc-600">Parking: </span>{place.parking_notes}</p>}{place.best_time_note && <p className="text-xs text-zinc-500"><span className="font-medium text-zinc-600">Best time: </span>{place.best_time_note}</p>}{place.typical_crowd_note && <p className="text-xs text-zinc-500"><span className="font-medium text-zinc-600">Typical crowd: </span>{place.typical_crowd_note}</p>}</div>}
        <AskGroupButton eventId={event.id} groupId={activeGroupId} groupName={activeGroupName} /><GroupAvailability eventId={event.id} groupId={activeGroupId} />
        <div className="mt-4"><LiveAttendees eventId={event.id} currentUserId={currentUserId} hasActiveGroup={hasActiveGroup} activeGroupName={activeGroupName} activeGroupMemberIds={activeGroupMemberIds} roster={roster} initialAttendees={attendees} /></div>
        <details className="mt-4 border-t border-zinc-100 pt-3"><summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold text-zinc-600">Comments {comments.length > 0 ? `(${comments.length})` : ""}</summary><div className="mt-1"><EventComments eventId={event.id} groupId={activeGroupId} currentUserId={currentUserId} currentUserName={currentUserName} initialComments={comments} roster={Object.fromEntries(Object.entries(roster).map(([id, p]) => [id, p.display_name]))} /></div></details>
        <details className="mt-2 border-t border-zinc-100 pt-3"><summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold text-zinc-600">Tips {tips.length > 0 ? `(${tips.length})` : ""}</summary><div className="mt-1"><TipsSection placeId={event.place_id ?? undefined} eventId={event.place_id ? undefined : event.id} groupId={activeGroupId} groupName={activeGroupName} currentUserId={currentUserId} tips={tips} /></div></details>
      </div></details>
    </EventCardShell>
  );
}
