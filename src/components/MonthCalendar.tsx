import Link from "next/link";
import type { FeedEvent } from "@/types";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function eventTime(event: FeedEvent) {
  if (event.time_unknown) return "Time to be confirmed";
  return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(new Date(event.starts_at));
}

export default function MonthCalendar({
  date,
  events,
  prevHref,
  nextHref,
}: {
  date: Date;
  events: FeedEvent[];
  prevHref: string;
  nextHref: string;
}) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startWeekday = firstOfMonth.getDay();
  const today = new Date();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;

  const eventsByDay = new Map<number, FeedEvent[]>();
  for (const event of events) {
    const day = new Date(event.starts_at).getDate();
    const list = eventsByDay.get(day) ?? [];
    list.push(event);
    eventsByDay.set(day, list);
  }

  const cells: (number | null)[] = [...Array(startWeekday).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);

  const monthLabel = firstOfMonth.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const mobileEvents = [...events].sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());

  return (
    <div className="w-full max-w-2xl">
      <div className="mb-4 flex items-center justify-between rounded-2xl border border-zinc-200 bg-white px-3 py-2 shadow-sm sm:border-0 sm:bg-transparent sm:px-0 sm:py-0 sm:shadow-none">
        <Link href={prevHref} className="inline-flex min-h-11 items-center rounded-xl px-2 text-sm font-semibold text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900">← Prev</Link>
        <h2 className="font-display text-xl font-bold text-zinc-950">{monthLabel}</h2>
        <Link href={nextHref} className="inline-flex min-h-11 items-center rounded-xl px-2 text-sm font-semibold text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900">Next →</Link>
      </div>

      <div className="sm:hidden">
        {mobileEvents.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 p-5 text-sm text-zinc-600">No outings yet this month.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {mobileEvents.map((event) => {
              const d = new Date(event.starts_at);
              return (
                <Link key={event.id} href={`#event-${event.id}`} className="flex min-h-[72px] items-center gap-3 rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm transition active:scale-[0.99] hover:border-rose-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500">
                  <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl bg-rose-50 text-rose-700">
                    <span className="text-[10px] font-bold uppercase">{d.toLocaleDateString(undefined, { weekday: "short" })}</span>
                    <span className="text-lg font-bold leading-none">{d.getDate()}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className={event.status === "cancelled" ? "truncate text-sm font-bold text-zinc-400 line-through" : "truncate text-sm font-bold text-zinc-900"}>{event.title}</div>
                    <div className="mt-1 text-xs font-semibold text-zinc-500">{eventTime(event)}{event.venue ? ` · ${event.venue}` : ""}</div>
                  </div>
                  <span aria-hidden="true" className="shrink-0 text-lg text-rose-600">→</span>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      <div className="hidden sm:block">
        <div className="grid grid-cols-7 gap-px overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-200 text-sm shadow-sm">
          {WEEKDAYS.map((day) => <div key={day} className="bg-zinc-50 px-2 py-2 text-center text-xs font-bold text-zinc-500">{day}</div>)}
          {cells.map((day, i) => {
            const dayEvents = day !== null ? (eventsByDay.get(day) ?? []) : [];
            return <div key={i} className={`min-h-20 bg-white px-2 py-2 ${day === null ? "bg-zinc-50" : ""}`}>
              {day !== null && <>
                <span className={isCurrentMonth && day === today.getDate() ? "inline-flex h-7 w-7 items-center justify-center rounded-full bg-zinc-900 text-xs font-bold text-white" : "inline-flex h-7 w-7 items-center justify-center text-xs font-semibold text-zinc-700"}>{day}</span>
                <div className="mt-1 flex flex-col gap-0.5">
                  {dayEvents.slice(0, 2).map((event) => <Link key={event.id} href={`#event-${event.id}`} className={event.status === "cancelled" ? "truncate rounded-lg bg-zinc-100 px-1.5 py-1 text-left text-[11px] text-zinc-400 line-through hover:bg-zinc-200" : "truncate rounded-lg bg-rose-50 px-1.5 py-1 text-left text-[11px] font-semibold text-rose-800 hover:bg-rose-100"} title={event.title}>{event.title}</Link>)}
                  {dayEvents.length > 2 && <span className="text-[11px] font-semibold text-zinc-400">+{dayEvents.length - 2} more</span>}
                </div>
              </>}
            </div>;
          })}
        </div>
        {events.length === 0 && <p className="mt-4 text-sm text-zinc-500">No outings yet.</p>}
      </div>
    </div>
  );
}
