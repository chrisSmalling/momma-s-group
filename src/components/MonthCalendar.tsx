"use client";
import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { isGoodAgeFit } from "@/lib/ageFit";
import { etYMD, isInEtMonth, isOnEtDay, type EtYMD } from "@/lib/date";
import type { FeedEvent, RsvpStatus } from "@/types";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type Filter = "all" | "free" | "indoor" | "outdoor" | "mine" | "going" | "age_fit";
type Mode = "plans" | "discovery";
type View = "agenda" | "grid";

const FILTERS: { id: Filter; label: string }[] = [{ id: "all", label: "All" }, { id: "free", label: "Free" }, { id: "indoor", label: "Indoor" }, { id: "outdoor", label: "Outdoor" }, { id: "mine", label: "Proposed" }, { id: "going", label: "I'm going" }, { id: "age_fit", label: "Good age fit" }];

function EmptyState({ mode, plansHref, onShowAll }: { mode: Mode; plansHref: string; onShowAll: () => void }) { if (mode === "plans") return <p className="mt-4 rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 p-5 text-sm text-zinc-600">Nothing locked in yet this month. <Link href={plansHref} className="underline">See what your group&apos;s up to</Link>, or <button type="button" onClick={onShowAll} className="underline">browse all events</button> to find something to propose.</p>; return <p className="mt-4 rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 p-5 text-sm text-zinc-600">Nothing matches these filters.</p>; }

// A human day header, today-forward: "Today"/"Tomorrow" take priority over
// "This weekend" (so a Saturday that IS today reads as "Today", not both),
// "This weekend" only covers the NEXT Sat/Sun (within a week out), and
// everything else — including past days, shown as-is rather than
// mislabeled — falls back to a plain weekday/date header.
function dayHeaderLabel(year: number, month0: number, day: number, todayEt: EtYMD): string {
  const diffDays = Math.round((Date.UTC(year, month0, day) - Date.UTC(todayEt.y, todayEt.m - 1, todayEt.d)) / 86400000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  const weekday = new Date(year, month0, day, 12).getDay();
  if (diffDays > 1 && diffDays <= 7 && (weekday === 0 || weekday === 6)) return "This weekend";
  return new Date(year, month0, day, 12).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

function groupByDay(items: FeedEvent[], year: number, month0: number, todayEt: EtYMD) {
  const groups: { key: string; label: string; isToday: boolean; events: FeedEvent[] }[] = [];
  for (const event of items) {
    const { d } = etYMD(event.starts_at);
    const key = `${year}-${month0}-${d}`;
    const last = groups.at(-1);
    if (last?.key === key) { last.events.push(event); continue; }
    const label = dayHeaderLabel(year, month0, d, todayEt);
    groups.push({ key, label, isToday: label === "Today", events: [event] });
  }
  return groups;
}

export default function MonthCalendar({ year, month0, events, prevHref, nextHref, cards, myRsvpByEvent, activeGroupId, childAgeMonths, plansHref }: { year: number; month0: number; events: FeedEvent[]; prevHref: string; nextHref: string; cards: Record<string, ReactNode>; myRsvpByEvent: Record<string, RsvpStatus>; activeGroupId: string | null; childAgeMonths: number | null; plansHref: string }) {
  const [query, setQuery] = useState(""); const [filter, setFilter] = useState<Filter>("all"); const [mode, setMode] = useState<Mode>("plans"); const [selectedDay, setSelectedDay] = useState<number | null>(null); const [view, setView] = useState<View>("agenda");
  const scoped = useMemo(() => { if (mode === "discovery") return events; return events.filter((e) => { const status = myRsvpByEvent[e.id]; if (status === "going" || status === "maybe") return true; return Boolean(activeGroupId) && e.proposed_by_group === activeGroupId; }); }, [events, mode, activeGroupId, myRsvpByEvent]);
  // Chronological — day-grouping (the mobile agenda) needs each day's
  // events contiguous. A proposal from your group still stands out via its
  // amber styling wherever it falls, and the banner above already gives it
  // top billing, so pinning it out of date order isn't needed to be seen.
  const filtered = useMemo(() => { const q = query.trim().toLowerCase(); return scoped.filter((e) => { if (!isInEtMonth(e.starts_at, year, month0)) return false; if (q && !`${e.title} ${e.venue ?? ""} ${e.address ?? ""}`.toLowerCase().includes(q)) return false; if (filter === "free" && !e.is_free) return false; if (filter === "indoor" && e.is_outdoor !== false) return false; if (filter === "outdoor" && e.is_outdoor !== true) return false; if (filter === "mine" && e.proposed_by_group == null) return false; if (filter === "going" && myRsvpByEvent[e.id] !== "going") return false; if (filter === "age_fit" && !isGoodAgeFit(childAgeMonths, e.age_min_months, e.age_max_months)) return false; return true; }).sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()); }, [scoped, query, filter, myRsvpByEvent, childAgeMonths, year, month0]);
  const listItems = useMemo(() => selectedDay == null ? filtered : filtered.filter((e) => isOnEtDay(e.starts_at, year, month0, selectedDay)), [filtered, selectedDay, year, month0]);
  const firstOfMonth = new Date(year, month0, 1, 12); const daysInMonth = new Date(year, month0 + 1, 0).getDate(); const startWeekday = firstOfMonth.getDay(); const todayEt = etYMD(new Date().toISOString()); const isCurrentMonth = todayEt.y === year && todayEt.m === month0 + 1;
  const eventsByDay = new Map<number, FeedEvent[]>(); for (const event of filtered) { const { d } = etYMD(event.starts_at); eventsByDay.set(d, [...(eventsByDay.get(d) ?? []), event]); }
  const proposalDays = new Set([...eventsByDay.entries()].filter(([, es]) => es.some((e) => e.proposed_by_group === activeGroupId)).map(([d]) => d));
  const dayGroups = useMemo(() => groupByDay(filtered, year, month0, todayEt), [filtered, year, month0, todayEt]);
  const cells: (number | null)[] = [...Array(startWeekday).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)]; while (cells.length % 7 !== 0) cells.push(null); const monthLabel = firstOfMonth.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  function selectDay(day: number) { setSelectedDay((current) => current === day ? null : day); } function switchMode(next: Mode) { setMode(next); setSelectedDay(null); }
  const proposalCount = filtered.filter((e) => e.proposed_by_group === activeGroupId).length;
  return <div className="w-full max-w-2xl">
    {proposalCount > 0 && <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4" role="status"><div className="text-sm font-bold text-amber-950">✨ {proposalCount === 1 ? "Your group has a meetup proposal" : `Your group has ${proposalCount} meetup proposals`}</div><p className="mt-1 text-xs text-amber-800">A group member suggested something. Review it below and decide if you want to go.</p></div>}
    <div className="mb-4 flex items-center justify-between rounded-2xl border border-zinc-200 bg-white px-3 py-2 shadow-sm sm:border-0 sm:bg-transparent sm:px-0 sm:py-0 sm:shadow-none"><Link href={prevHref} className="inline-flex min-h-11 items-center rounded-xl px-2 text-sm font-semibold text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900">← Prev</Link><h2 className="font-display text-xl font-bold text-zinc-950">{monthLabel}</h2><Link href={nextHref} className="inline-flex min-h-11 items-center rounded-xl px-2 text-sm font-semibold text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900">Next →</Link></div>
    <div className="mb-4 flex items-center gap-1 rounded-2xl border border-zinc-200 bg-white p-1 shadow-sm"><button type="button" onClick={() => switchMode("plans")} className={mode === "plans" ? "min-h-10 flex-1 rounded-xl bg-zinc-900 px-3 py-2 text-sm font-bold text-white" : "min-h-10 flex-1 rounded-xl px-3 py-2 text-sm font-semibold text-zinc-600 hover:bg-zinc-50"}>Your plans</button><button type="button" onClick={() => switchMode("discovery")} className={mode === "discovery" ? "min-h-10 flex-1 rounded-xl bg-zinc-900 px-3 py-2 text-sm font-bold text-white" : "min-h-10 flex-1 rounded-xl px-3 py-2 text-sm font-semibold text-zinc-600 hover:bg-zinc-50"}>All events</button></div>
    <div className="mb-5 rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm"><label htmlFor="calendar-search" className="sr-only">Search calendar</label><input id="calendar-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search your plans…" className="w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-sm outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100" /><div className="mt-3 flex gap-2 overflow-x-auto pb-1">{FILTERS.map((f) => <button key={f.id} type="button" onClick={() => setFilter(f.id)} className={filter === f.id ? "min-h-10 shrink-0 rounded-full bg-zinc-900 px-3 py-2 text-xs font-bold text-white" : "min-h-10 shrink-0 rounded-full border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-700"}>{f.label}</button>)}</div><div className="mt-2 flex items-center justify-between gap-2"><p className="text-xs text-zinc-500">{filtered.length} {mode === "plans" ? "planned" : "matching"} option{filtered.length === 1 ? "" : "s"}{selectedDay != null ? ` · ${monthLabel.split(" ")[0]} ${selectedDay} only` : ""}</p><button type="button" onClick={() => setView((v) => v === "agenda" ? "grid" : "agenda")} className="shrink-0 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 sm:hidden">{view === "agenda" ? "🗓️ Month view" : "📋 Agenda"}</button></div></div>
    {selectedDay != null && <button type="button" onClick={() => setSelectedDay(null)} className={`mb-3 min-h-9 items-center gap-1 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-600 ${view === "grid" ? "inline-flex" : "hidden"} sm:inline-flex`}>← Show the whole month</button>}

    {/* Mobile agenda: one grouped, day-headered list — the default mobile view. */}
    <div className={`${view === "agenda" ? "block" : "hidden"} sm:hidden`}>
      {filtered.length === 0 ? <EmptyState mode={mode} plansHref={plansHref} onShowAll={() => switchMode("discovery")} /> : (
        <div className="flex flex-col gap-5">
          {dayGroups.map((group) => (
            <div key={group.key}>
              <h3 className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-zinc-500">
                {group.isToday && <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-rose-600" />}
                {group.label}
              </h3>
              <div className="flex flex-col gap-4">{group.events.map((event) => cards[event.id] ?? null)}</div>
            </div>
          ))}
        </div>
      )}
    </div>

    {/* Month grid: always on desktop, opt-in "zoom out" on mobile. */}
    <div className={`${view === "grid" ? "block" : "hidden"} sm:block`}>
      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-200 text-sm shadow-sm">{WEEKDAYS.map((day) => <div key={day} className="bg-zinc-50 px-2 py-2 text-center text-xs font-bold text-zinc-500">{day}</div>)}{cells.map((day, i) => { const dayEvents = day !== null ? (eventsByDay.get(day) ?? []) : []; const selected = day !== null && selectedDay === day; const proposal = day !== null && proposalDays.has(day); return <div key={i} className={`min-h-20 px-2 py-2 ${day === null ? "bg-zinc-50" : proposal ? "bg-amber-50" : "bg-white"} ${selected ? "ring-2 ring-inset ring-rose-400" : ""}`}>{day !== null && <button type="button" onClick={() => dayEvents.length > 0 && selectDay(day)} disabled={dayEvents.length === 0} className={proposal ? "inline-flex h-7 w-7 items-center justify-center rounded-full bg-amber-500 text-xs font-bold text-white" : isCurrentMonth && day === todayEt.d ? "inline-flex h-7 w-7 items-center justify-center rounded-full bg-zinc-900 text-xs font-bold text-white" : "inline-flex h-7 w-7 items-center justify-center text-xs font-semibold text-zinc-700 disabled:cursor-default"}>{day}</button>}{day !== null && <div className="mt-1 flex flex-col gap-0.5">{dayEvents.slice(0, 2).map((event) => { const p = event.proposed_by_group === activeGroupId; return <button key={event.id} type="button" onClick={() => selectDay(day)} className={event.status === "cancelled" ? "truncate rounded-lg bg-zinc-100 px-1.5 py-1 text-left text-[11px] text-zinc-400 line-through" : p ? "truncate rounded-lg bg-amber-200 px-1.5 py-1 text-left text-[11px] font-bold text-amber-950" : "truncate rounded-lg bg-rose-50 px-1.5 py-1 text-left text-[11px] font-semibold text-rose-800"} title={event.title}>{p ? "✨ " : ""}{event.title}</button>; })}{dayEvents.length > 2 && <button type="button" onClick={() => selectDay(day)} className="text-left text-[11px] font-semibold text-zinc-400">+{dayEvents.length - 2} more</button>}</div>}</div>; })}</div>
      {filtered.length === 0 && <EmptyState mode={mode} plansHref={plansHref} onShowAll={() => switchMode("discovery")} />}
    </div>

    {/* Flat detail-card list: pairs with the grid (day-selection results on
        desktop always, or on mobile while zoomed out to the grid). The
        agenda above already covers this ground on mobile by default. */}
    <div className={`mt-8 flex-col gap-4 ${view === "grid" ? "flex" : "hidden"} sm:flex`}>
      {listItems.map((event) => cards[event.id] ?? null)}
    </div>
  </div>;
}
