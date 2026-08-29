import Link from "next/link";

// Server-renderable — no "use client", so it can drop into a client-boundary
// parent (see MonthCalendar's EmptyState) without adding its own JS chunk,
// matching PoppyTodayEntry's chip-deep-link pattern rather than calling the
// live recommend API from every empty state.
export default function PoppyNudge({
  heading,
  subtext,
  ask,
  groupId,
}: {
  heading: string;
  subtext?: string;
  ask: string;
  groupId?: string | null;
}) {
  const params = new URLSearchParams({ ask });
  if (groupId) params.set("group", groupId);
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4">
      <div className="min-w-0">
        <div className="text-sm font-bold text-rose-950">🌼 {heading}</div>
        {subtext && <p className="mt-1 text-xs text-rose-800">{subtext}</p>}
      </div>
      <Link
        href={`/places?${params.toString()}`}
        prefetch={false}
        className="shrink-0 rounded-full bg-rose-600 px-3 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-rose-700"
      >
        Ask Poppy →
      </Link>
    </div>
  );
}
