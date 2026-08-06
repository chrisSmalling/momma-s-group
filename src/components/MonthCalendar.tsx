import Link from "next/link";
import type { Event } from "@/types";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function MonthCalendar({
  date,
  events,
  prevHref,
  nextHref,
}: {
  date: Date;
  events: Event[];
  prevHref: string;
  nextHref: string;
}) {
  const year = date.getFullYear();
  const month = date.getMonth();

  const firstOfMonth = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startWeekday = firstOfMonth.getDay();
  const today = new Date();
  const isCurrentMonth =
    today.getFullYear() === year && today.getMonth() === month;

  const eventsByDay = new Map<number, Event[]>();
  for (const event of events) {
    const day = new Date(event.starts_at).getDate();
    const list = eventsByDay.get(day) ?? [];
    list.push(event);
    eventsByDay.set(day, list);
  }

  const cells: (number | null)[] = [
    ...Array(startWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const monthLabel = firstOfMonth.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="w-full max-w-2xl">
      <div className="mb-4 flex items-center justify-between">
        <Link href={prevHref} className="text-sm text-zinc-500 hover:text-zinc-900">
          ← Prev
        </Link>
        <h2 className="text-xl font-semibold">{monthLabel}</h2>
        <Link href={nextHref} className="text-sm text-zinc-500 hover:text-zinc-900">
          Next →
        </Link>
      </div>
      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-md border border-zinc-200 bg-zinc-200 text-sm">
        {WEEKDAYS.map((day) => (
          <div
            key={day}
            className="bg-zinc-50 px-2 py-1.5 text-center font-medium text-zinc-500"
          >
            {day}
          </div>
        ))}
        {cells.map((day, i) => {
          const dayEvents = day !== null ? (eventsByDay.get(day) ?? []) : [];
          return (
            <div
              key={i}
              className={`min-h-16 bg-white px-2 py-1.5 ${day === null ? "bg-zinc-50" : ""}`}
            >
              {day !== null && (
                <>
                  <span
                    className={
                      isCurrentMonth && day === today.getDate()
                        ? "inline-flex h-6 w-6 items-center justify-center rounded-full bg-zinc-900 text-white"
                        : "text-zinc-700"
                    }
                  >
                    {day}
                  </span>
                  <div className="mt-1 flex flex-col gap-0.5">
                    {dayEvents.slice(0, 2).map((event) => (
                      <span
                        key={event.id}
                        className="truncate rounded bg-zinc-100 px-1 py-0.5 text-[11px] text-zinc-700"
                        title={event.title}
                      >
                        {event.title}
                      </span>
                    ))}
                    {dayEvents.length > 2 && (
                      <span className="text-[11px] text-zinc-400">
                        +{dayEvents.length - 2} more
                      </span>
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
      {events.length === 0 && (
        <p className="mt-4 text-sm text-zinc-500">No outings yet.</p>
      )}
    </div>
  );
}
