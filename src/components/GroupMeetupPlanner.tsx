"use client";

import { useMemo, useState } from "react";
import { groupRecommendationReason, rankGroupCandidates, type GroupCandidate, type GroupMember } from "@/lib/group-recommendations";

type Props = { groupName: string; members: GroupMember[]; candidates: GroupCandidate[] };

export default function GroupMeetupPlanner({ groupName, members, candidates }: Props) {
  const [open, setOpen] = useState(false);
  const [budget, setBudget] = useState<"free" | "low" | "any">("any");
  const [mode, setMode] = useState<"indoor" | "outdoor" | "any">("any");
  const [maxMiles, setMaxMiles] = useState(20);
  const ranked = useMemo(() => rankGroupCandidates(candidates, members, { budget, indoorOutdoor: mode, maxMiles }), [candidates, members, budget, mode, maxMiles]);
  const picks = ranked.slice(0, 4);
  const kidCount = members.reduce((n, m) => n + m.children.length, 0);

  if (!open) return <button type="button" onClick={() => setOpen(true)} className="mb-6 w-full rounded-2xl border border-rose-200 bg-rose-50 p-4 text-left shadow-sm transition hover:border-rose-300"><div className="text-xs font-bold uppercase tracking-[0.14em] text-rose-600">Meetup helper</div><div className="mt-1 font-display text-lg font-bold text-zinc-950">✨ Find something that works for the whole group</div><div className="mt-1 text-sm text-zinc-600">I’ll balance the kids’ ages, travel, budget and practical parent needs.</div></button>;

  return <section className="mb-6 rounded-2xl border border-rose-100 bg-gradient-to-br from-rose-50 via-white to-amber-50 p-4 shadow-sm sm:p-5">
    <div className="flex items-start justify-between gap-3"><div><div className="text-xs font-bold uppercase tracking-[0.14em] text-rose-600">Group meetup helper</div><h2 className="mt-1 font-display text-xl font-bold text-zinc-950">Let’s find a good fit for {groupName}.</h2><p className="mt-1 text-sm text-zinc-600">I’m considering {members.length} moms and {kidCount} kids.</p></div><button type="button" onClick={() => setOpen(false)} className="text-xs font-bold text-zinc-500">Close</button></div>
    <div className="mt-4 grid gap-3 sm:grid-cols-3">
      <label className="text-xs font-bold text-zinc-600">Vibe<select value={mode} onChange={e => setMode(e.target.value as typeof mode)} className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium"><option value="any">Anything</option><option value="indoor">Indoor</option><option value="outdoor">Outdoor</option></select></label>
      <label className="text-xs font-bold text-zinc-600">Budget<select value={budget} onChange={e => setBudget(e.target.value as typeof budget)} className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium"><option value="any">Any</option><option value="free">Free</option><option value="low">Low cost</option></select></label>
      <label className="text-xs font-bold text-zinc-600">Max drive<select value={maxMiles} onChange={e => setMaxMiles(Number(e.target.value))} className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium"><option value="5">5 miles</option><option value="10">10 miles</option><option value="20">20 miles</option><option value="30">30 miles</option></select></label>
    </div>
    <div className="mt-4 space-y-2">{picks.length ? picks.map((candidate, index) => <article key={candidate.id} className="rounded-2xl border border-zinc-200 bg-white p-4"><div className="flex items-start justify-between gap-3"><div><div className="text-[11px] font-bold uppercase tracking-wide text-rose-600">{index === 0 ? "Best group fit" : "Also consider"}</div><h3 className="mt-1 font-bold text-zinc-950">{candidate.name}</h3><p className="mt-1 text-sm text-zinc-600">{groupRecommendationReason(candidate, members, { budget, indoorOutdoor: mode, maxMiles })}</p></div><span className="text-lg">{candidate.isOutdoor ? "🌳" : "🏠"}</span></div><div className="mt-3 flex flex-wrap gap-1.5">{candidate.hasChangingTable && <span className="rounded-full bg-zinc-100 px-2 py-1 text-[11px]">Changing table</span>}{candidate.restrooms && <span className="rounded-full bg-zinc-100 px-2 py-1 text-[11px]">Restrooms</span>}{candidate.strollerAccessible && <span className="rounded-full bg-zinc-100 px-2 py-1 text-[11px]">Stroller-friendly</span>}{candidate.enclosed && <span className="rounded-full bg-zinc-100 px-2 py-1 text-[11px]">Enclosed</span>}</div></article>) : <p className="rounded-xl bg-white p-4 text-sm text-zinc-600">I don’t have a verified place that meets those constraints yet. Try a larger drive radius or broader vibe.</p>}</div>
    <p className="mt-3 text-xs text-zinc-500">This is recommendation logic, not a paid AI agent. It uses the group’s actual member and venue data.</p>
  </section>;
}
