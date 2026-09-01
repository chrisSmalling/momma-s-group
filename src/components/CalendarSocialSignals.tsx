"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

 type Activity = { event_id: string; title: string; starts_at: string; going_count: number };

export default function CalendarSocialSignals() {
  const [items, setItems] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let mounted = true;
    const supabase = createClient();
    const load = async () => {
      const { data, error } = await supabase
        .from("group_activity_feed")
        .select("event_id,title,starts_at,going_count")
        .gt("going_count", 0)
        .gte("starts_at", new Date().toISOString())
        .order("starts_at", { ascending: true })
        .limit(5);
      if (error) console.error("[calendar] group activity feed failed", error.message);
      if (mounted) { setItems((data ?? []) as Activity[]); setLoading(false); }
    };
    load();
    return () => { mounted = false; };
  }, []);

  // While loading, a lightweight placeholder — otherwise "still fetching",
  // "the fetch failed", and "your group genuinely has nothing going" all
  // render as the exact same nothing, and a slow connection looks
  // indistinguishable from a bug.
  if (loading) {
    return (
      <div aria-hidden="true" className="mb-5 h-[104px] animate-pulse rounded-2xl border border-zinc-100 bg-zinc-50" />
    );
  }
  if (!items.length) return null;
  return <section aria-label="Friends going" className="mb-5 rounded-2xl border border-rose-200 bg-rose-50 p-4 shadow-sm">
    <div className="mb-2 flex items-center justify-between gap-3">
      <div><h2 className="text-sm font-extrabold text-rose-950">👥 Your friends are going</h2><p className="text-xs text-rose-800">See what moms in your groups already have plans for.</p></div>
      <span className="shrink-0 rounded-full bg-white px-2 py-1 text-[10px] font-bold text-rose-700">Upcoming</span>
    </div>
    <div className="flex gap-2 overflow-x-auto pb-1">
      {items.map((item) => <Link key={item.event_id} href={`/events/${item.event_id}`} className="min-w-[190px] rounded-xl border border-rose-200 bg-white p-3 hover:border-rose-300">
        <div className="text-sm font-bold text-zinc-900">{item.title}</div>
        <div className="mt-1 text-xs font-semibold text-zinc-500">{new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/New_York" }).format(new Date(item.starts_at))}</div>
        <div className="mt-2 text-xs font-extrabold text-rose-700">👥 {item.going_count} {item.going_count === 1 ? "friend" : "friends"} going →</div>
      </Link>)}
    </div>
  </section>;
}
