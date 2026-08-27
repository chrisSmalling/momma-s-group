"use client";

import Link from "next/link";
import { useOptimistic, useTransition } from "react";
import { rsvp } from "@/app/(app)/calendar/actions";
import GoingAvatars from "@/components/GoingAvatars";
import PracticalityIcons from "@/components/PracticalityIcons";
import { isFreeCost } from "@/lib/cost";
import type { FeedEvent, RsvpStatus, VenuePracticalities } from "@/types";

type Person = { user_id: string; display_name: string; avatar_color: string };

function dateBadgeParts(event: FeedEvent) {
  const d = new Date(event.starts_at);
  return { weekday: d.toLocaleDateString(undefined, { weekday: "short" }), day: d.getDate() };
}
function formatTime(event: FeedEvent) {
  if (event.time_unknown) return "Check times";
  return new Date(event.starts_at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export default function CommitmentCard({
  event,
  place,
  going,
  maybe,
  memberCount,
  currentUserId,
  currentUserName,
  currentStatus,
  groupName,
  groupLabel,
  proposedByName,
}: {
  event: FeedEvent;
  place: VenuePracticalities | null;
  going: Person[];
  maybe: Person[];
  memberCount: number;
  currentUserId: string;
  currentUserName: string;
  currentStatus: RsvpStatus | null;
  groupName: string | null;
  // Shown only in "all my groups" mode, to say which group this came from.
  groupLabel?: string;
  // Set only for "being planned" cards — a proposed meetup nobody's
  // committed to yet.
  proposedByName?: string | null;
}) {
  const [optimisticStatus, setOptimisticStatus] = useOptimistic(currentStatus);
  const [isPending, startTransition] = useTransition();
  const { weekday, day } = dateBadgeParts(event);
  const everyoneIn = memberCount > 1 && going.length >= memberCount;

  function handleTap(status: RsvpStatus) {
    const next = optimisticStatus === status ? null : status;
    startTransition(async () => {
      setOptimisticStatus(next);
      await rsvp(event.id, next, null);
    });
  }

  // Reflect the optimistic tap in the avatar row immediately, without
  // waiting for the page's next server fetch.
  const displayGoing = going.filter((p) => p.user_id !== currentUserId);
  if (optimisticStatus === "going") displayGoing.unshift({ user_id: currentUserId, display_name: currentUserName, avatar_color: going.find((p) => p.user_id === currentUserId)?.avatar_color ?? maybe.find((p) => p.user_id === currentUserId)?.avatar_color ?? "#C0356E" });
  const displayMaybeCount = maybe.filter((p) => p.user_id !== currentUserId).length + (optimisticStatus === "maybe" ? 1 : 0);

  return (
    <article className="overflow-hidden rounded-3xl border border-zinc-200/80 bg-white shadow-sm">
      {everyoneIn && (
        <div className="bg-emerald-600 px-4 py-1.5 text-center text-xs font-bold text-white">Everyone&apos;s in 🎉</div>
      )}
      <div className="p-4 sm:p-5">
        <div className="flex gap-3">
          <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-2xl bg-rose-50 text-rose-700">
            <span className="text-[10px] font-bold uppercase tracking-wide">{weekday}</span>
            <span className="text-xl font-bold leading-none">{day}</span>
          </div>
          <div className="min-w-0 flex-1">
            <Link href={`/events/${event.id}`} className="group block">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-display truncate text-lg font-bold text-zinc-900 group-hover:text-rose-700">{event.title}</h3>
                {isFreeCost(event.cost) && <span className="shrink-0 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-700">Free</span>}
              </div>
              <p className="text-sm font-semibold text-zinc-600">{formatTime(event)}</p>
              {event.venue && <p className="truncate text-sm text-zinc-500">{event.venue}</p>}
            </Link>
            {groupLabel && <span className="mt-1 inline-block rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-semibold text-zinc-500">{groupLabel}</span>}
          </div>
        </div>

        <div className="mt-3">
          {proposedByName ? (
            <p className="text-sm italic text-zinc-500">Proposed by {proposedByName} — nobody&apos;s locked in yet</p>
          ) : (
            <>
              <GoingAvatars going={displayGoing} currentUserId={currentUserId} groupName={groupName} hasActiveGroup />
              {displayMaybeCount > 0 && <p className="mt-1 text-xs text-zinc-400">+{displayMaybeCount} maybe</p>}
            </>
          )}
        </div>

        {place && (
          <div className="mt-2">
            <PracticalityIcons practicalities={place} />
          </div>
        )}

        <div className="mt-4 flex items-center gap-2">
          <button
            type="button"
            disabled={isPending}
            onClick={() => handleTap("going")}
            className={
              optimisticStatus === "going"
                ? "motion-safe:active:scale-95 min-h-11 flex-1 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white shadow-sm transition-transform disabled:opacity-60"
                : "motion-safe:active:scale-95 min-h-11 flex-1 rounded-2xl bg-rose-600 px-5 py-3 text-sm font-bold text-white shadow-sm transition-transform hover:bg-rose-700 disabled:opacity-60"
            }
          >
            {optimisticStatus === "going" ? "✓ I'm in" : "I'm in"}
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={() => handleTap("maybe")}
            className={
              optimisticStatus === "maybe"
                ? "motion-safe:active:scale-95 min-h-11 rounded-2xl border-2 border-zinc-900 bg-white px-4 py-3 text-sm font-bold text-zinc-900 transition-transform disabled:opacity-60"
                : "motion-safe:active:scale-95 min-h-11 rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm font-semibold text-zinc-700 transition-transform hover:border-zinc-400 disabled:opacity-60"
            }
          >
            {optimisticStatus === "maybe" ? "✓ Maybe" : "Maybe"}
          </button>
        </div>
      </div>
    </article>
  );
}
