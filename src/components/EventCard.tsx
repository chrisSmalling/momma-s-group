import { rsvp } from "@/app/calendar/actions";
import type { Event, RsvpStatus } from "@/types";

type Attendee = {
  user_id: string;
  status: RsvpStatus;
  display_name: string;
  avatar_color: string;
};

function formatWhen(event: Event) {
  const starts = new Date(event.starts_at);
  const datePart = starts.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const timePart = starts.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
  return `${datePart} · ${timePart}`;
}

function AttendeeLine({
  label,
  people,
  currentUserId,
}: {
  label: string;
  people: Attendee[];
  currentUserId: string;
}) {
  if (people.length === 0) return null;
  return (
    <p className="text-zinc-600">
      <span className="font-medium text-zinc-700">{label}: </span>
      {people
        .map((p) =>
          p.user_id === currentUserId ? `${p.display_name} (you)` : p.display_name,
        )
        .join(", ")}
    </p>
  );
}

export default function EventCard({
  event,
  currentUserId,
  currentStatus,
  attendees,
  hasActiveGroup,
}: {
  event: Event;
  currentUserId: string;
  currentStatus: RsvpStatus | null;
  attendees: Attendee[];
  hasActiveGroup: boolean;
}) {
  const going = attendees.filter((a) => a.status === "going");
  const maybe = attendees.filter((a) => a.status === "maybe");
  const subtitle = [event.venue_name, event.cost || "Free"]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="rounded-md border border-zinc-200 p-4">
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <h3 className="text-base font-semibold">{event.title}</h3>
        <span className="text-xs text-zinc-500">{formatWhen(event)}</span>
      </div>
      <p className="mb-2 text-sm text-zinc-500">{subtitle}</p>
      {event.age_tags.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1">
          {event.age_tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      <div className="mb-3 flex gap-2">
        <form action={rsvp}>
          <input type="hidden" name="eventId" value={event.id} />
          <input type="hidden" name="status" value="going" />
          <button
            type="submit"
            className={
              currentStatus === "going"
                ? "rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white"
                : "rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 hover:border-zinc-500"
            }
          >
            {currentStatus === "going" ? "✓ Going" : "Going"}
          </button>
        </form>
        <form action={rsvp}>
          <input type="hidden" name="eventId" value={event.id} />
          <input type="hidden" name="status" value="maybe" />
          <button
            type="submit"
            className={
              currentStatus === "maybe"
                ? "rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white"
                : "rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 hover:border-zinc-500"
            }
          >
            {currentStatus === "maybe" ? "✓ Maybe" : "Maybe"}
          </button>
        </form>
      </div>

      {hasActiveGroup ? (
        <div className="flex flex-col gap-1 text-sm">
          <AttendeeLine label="Going" people={going} currentUserId={currentUserId} />
          <AttendeeLine label="Maybe" people={maybe} currentUserId={currentUserId} />
          {going.length === 0 && maybe.length === 0 && (
            <p className="text-zinc-400">No one from this group has RSVP&apos;d yet.</p>
          )}
        </div>
      ) : (
        <p className="text-sm text-zinc-400">Join a group to see who else is going.</p>
      )}
    </div>
  );
}
