import EventCardShell from "@/components/EventCardShell";
import GoingAvatars from "@/components/GoingAvatars";
import type { Event, RsvpStatus } from "@/types";

type Attendee = {
  user_id: string;
  status: RsvpStatus;
  display_name: string;
  avatar_color: string;
};

function dateBadgeParts(event: Event) {
  const d = new Date(event.starts_at);
  return {
    weekday: d.toLocaleDateString(undefined, { weekday: "short" }),
    day: d.getDate(),
  };
}

function formatTime(event: Event) {
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

export default function EventCard({
  event,
  currentUserId,
  currentStatus,
  attendees,
  hasActiveGroup,
  activeGroupName,
}: {
  event: Event;
  currentUserId: string;
  currentStatus: RsvpStatus | null;
  attendees: Attendee[];
  hasActiveGroup: boolean;
  activeGroupName: string | null;
}) {
  const going = attendees.filter((a) => a.status === "going");
  const maybe = attendees.filter((a) => a.status === "maybe");
  const { weekday, day } = dateBadgeParts(event);

  return (
    <EventCardShell eventId={event.id} currentStatus={currentStatus}>
      <div className="flex gap-3">
        <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl bg-rose-50 text-rose-700">
          <span className="text-[10px] font-semibold uppercase tracking-wide">
            {weekday}
          </span>
          <span className="text-xl font-bold leading-none">{day}</span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="truncate text-lg font-bold text-zinc-900">
              {event.title}
            </h3>
            <CostPill cost={event.cost} />
          </div>
          <p className="text-sm font-semibold text-zinc-600">
            {formatTime(event)}
          </p>
          {event.venue_name && (
            <p className="truncate text-sm text-zinc-500">
              {event.venue_name}
            </p>
          )}
          {event.age_tags.length > 0 && (
            <span className="mt-1.5 inline-block rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-medium text-rose-600">
              {event.age_tags.join(" · ")}
            </span>
          )}
          {event.description && (
            <p className="mt-1.5 line-clamp-2 text-xs text-zinc-400">
              {event.description}
            </p>
          )}
        </div>
      </div>

      <div className="mt-4">
        <GoingAvatars
          going={going}
          currentUserId={currentUserId}
          groupName={activeGroupName}
          hasActiveGroup={hasActiveGroup}
        />
        {maybe.length > 0 && (
          <p className="mt-1.5 text-xs text-zinc-400">
            Maybe:{" "}
            {maybe
              .map((p) =>
                p.user_id === currentUserId
                  ? `${p.display_name} (you)`
                  : p.display_name,
              )
              .join(", ")}
          </p>
        )}
      </div>
    </EventCardShell>
  );
}
