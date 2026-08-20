import EventCardShell from "@/components/EventCardShell";
import LiveAttendees from "@/components/LiveAttendees";
import PracticalityIcons from "@/components/PracticalityIcons";
import EventComments from "@/components/EventComments";
import TipsSection from "@/components/TipsSection";
import IndoorOutdoorTag from "@/components/IndoorOutdoorTag";
import AgeFitBadge from "@/components/AgeFitBadge";
import { isGoodAgeFit } from "@/lib/ageFit";
import type { FeedEvent, Place, PlaceTip, RsvpStatus, EventComment } from "@/types";

type Attendee = {
  user_id: string;
  status: RsvpStatus;
  display_name: string;
  avatar_color: string;
};

type ProposedBy = {
  user_id: string;
  display_name: string;
};

type PlaceContext = Pick<
  Place,
  | "is_enclosed"
  | "has_changing_table"
  | "nursing_friendly"
  | "stroller_accessible"
  | "food_onsite"
  | "quiet_or_sensory_friendly"
  | "parking_notes"
  | "best_time_note"
  | "typical_crowd_note"
  | "what_to_bring"
>;

type CommentDisplay = EventComment & { display_name: string };
type TipDisplay = PlaceTip & { display_name: string };

function dateBadgeParts(event: FeedEvent) {
  const d = new Date(event.starts_at);
  return {
    weekday: d.toLocaleDateString(undefined, { weekday: "short" }),
    day: d.getDate(),
  };
}

// time_unknown (time_precision = 'date_only') means the source only gave
// us a date, not a real start time — starts_at is midnight-filled to
// satisfy the NOT NULL constraint, not an actual time, so it must never
// be rendered as one.
function formatTime(event: FeedEvent) {
  if (event.time_unknown) return "Check times";
  return new Date(event.starts_at).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

function CostPill({ cost }: { cost: string | null }) {
  if (!cost) {
    return (
      <span className="shrink-0 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
        Free
      </span>
    );
  }
  return (
    <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
      {cost}
    </span>
  );
}

function CancelledPill() {
  return (
    <span className="shrink-0 rounded-full bg-zinc-200 px-2.5 py-0.5 text-xs font-semibold text-zinc-600">
      Cancelled
    </span>
  );
}

function NoteLine({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <p className="text-xs text-zinc-500">
      <span className="font-medium text-zinc-600">{label}: </span>
      {value}
    </p>
  );
}

export default function EventCard({
  event,
  currentUserId,
  currentUserName,
  currentStatus,
  currentNote,
  attendees,
  hasActiveGroup,
  activeGroupId,
  activeGroupName,
  activeGroupMemberIds,
  roster,
  proposedBy,
  place,
  duringNap,
  comments,
  tips,
  childAgeMonths,
}: {
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
  // Viewer's profiles.child_age_months, when set — drives the "Good fit"
  // badge. Omit when unknown so nothing renders (see isGoodAgeFit).
  childAgeMonths?: number | null;
}) {
  const { weekday, day } = dateBadgeParts(event);
  const cancelled = event.status === "cancelled";
  const bring = event.what_to_bring.length > 0 ? event.what_to_bring : (place?.what_to_bring ?? []);
  const goodAgeFit = isGoodAgeFit(childAgeMonths, event.age_min_months, event.age_max_months);

  return (
    <EventCardShell
      eventId={event.id}
      currentStatus={currentStatus}
      currentNote={currentNote}
      disabled={cancelled}
      duringNap={duringNap}
    >
      <div className="flex gap-3">
        <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl bg-rose-50 text-rose-700">
          <span className="text-[10px] font-semibold uppercase tracking-wide">
            {weekday}
          </span>
          <span className="text-xl font-bold leading-none">{day}</span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3
              className={
                cancelled
                  ? "truncate text-lg font-bold text-zinc-400 line-through"
                  : "truncate text-lg font-bold text-zinc-900"
              }
            >
              {event.title}
            </h3>
            {cancelled ? <CancelledPill /> : <CostPill cost={event.cost} />}
          </div>
          <p className="text-sm font-semibold text-zinc-600">
            {formatTime(event)}
          </p>
          {event.venue && (
            <p className="truncate text-sm text-zinc-500">
              {event.venue}
              {event.room_name ? ` · ${event.room_name}` : ""}
            </p>
          )}
          {(event.age_tags.length > 0 || goodAgeFit) && (
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              {event.age_tags.length > 0 && (
                <span className="inline-block rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-medium text-rose-600">
                  {event.age_tags.join(" · ")}
                </span>
              )}
              {goodAgeFit && <AgeFitBadge />}
            </div>
          )}
          <div className="mt-1.5">
            <IndoorOutdoorTag isOutdoor={event.is_outdoor} />
          </div>
          {event.description && (
            <p className="mt-1.5 line-clamp-2 text-xs text-zinc-400">
              {event.description}
            </p>
          )}
          {proposedBy && (
            <p className="mt-1.5 text-xs italic text-zinc-400">
              Proposed by{" "}
              {proposedBy.user_id === currentUserId
                ? "you"
                : proposedBy.display_name}
            </p>
          )}
        </div>
      </div>

      {event.registration_required && (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800">
          <span>Registration required</span>
          {event.registration_url && (
            <a
              href={event.registration_url}
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              Register →
            </a>
          )}
        </div>
      )}

      {bring.length > 0 && (
        <p className="mt-3 text-sm font-semibold text-rose-700">
          Bring: {bring.join(", ")}
        </p>
      )}

      {place && (
        <div className="mt-2 flex flex-col gap-1.5">
          <PracticalityIcons practicalities={place} />
          <NoteLine label="Parking" value={place.parking_notes} />
          <NoteLine label="Best time" value={place.best_time_note} />
          <NoteLine label="Typical crowd" value={place.typical_crowd_note} />
        </div>
      )}

      <div className="mt-4">
        <LiveAttendees
          eventId={event.id}
          currentUserId={currentUserId}
          hasActiveGroup={hasActiveGroup}
          activeGroupName={activeGroupName}
          activeGroupMemberIds={activeGroupMemberIds}
          roster={roster}
          initialAttendees={attendees}
        />
      </div>

      <details className="mt-4 border-t border-zinc-100 pt-3">
        <summary className="cursor-pointer text-xs font-semibold text-zinc-500">
          Comments {comments.length > 0 ? `(${comments.length})` : ""}
        </summary>
        <div className="mt-3">
          <EventComments
            eventId={event.id}
            groupId={activeGroupId}
            currentUserId={currentUserId}
            currentUserName={currentUserName}
            initialComments={comments}
            roster={Object.fromEntries(
              Object.entries(roster).map(([id, p]) => [id, p.display_name]),
            )}
          />
        </div>
      </details>

      <details className="mt-3 border-t border-zinc-100 pt-3">
        <summary className="cursor-pointer text-xs font-semibold text-zinc-500">
          Tips {tips.length > 0 ? `(${tips.length})` : ""}
        </summary>
        <div className="mt-3">
          <TipsSection
            placeId={event.place_id ?? undefined}
            eventId={event.place_id ? undefined : event.id}
            groupId={activeGroupId}
            groupName={activeGroupName}
            currentUserId={currentUserId}
            tips={tips}
          />
        </div>
      </details>
    </EventCardShell>
  );
}
