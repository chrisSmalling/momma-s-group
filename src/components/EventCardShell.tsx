"use client";

import { useOptimistic, useState, useTransition, type ReactNode } from "react";
import { rsvp } from "@/app/calendar/actions";
import type { RsvpStatus } from "@/types";

export default function EventCardShell({
  eventId,
  currentStatus,
  disabled = false,
  children,
}: {
  eventId: string;
  currentStatus: RsvpStatus | null;
  disabled?: boolean;
  children: ReactNode;
}) {
  const [optimisticStatus, setOptimisticStatus] = useOptimistic(currentStatus);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick(status: RsvpStatus) {
    const next = optimisticStatus === status ? null : status;
    setError(null);
    startTransition(async () => {
      setOptimisticStatus(next);
      const result = await rsvp(eventId, next);
      if (result?.error) {
        setError(result.error);
      }
    });
  }

  const cardClass = disabled
    ? "scroll-mt-4 rounded-2xl border border-zinc-200 bg-zinc-50 p-4"
    : optimisticStatus === "going"
      ? "scroll-mt-4 rounded-2xl border border-rose-200 bg-rose-50/60 p-4 transition-colors"
      : "scroll-mt-4 rounded-2xl border border-zinc-200 bg-white p-4 transition-colors";

  return (
    <div id={`event-${eventId}`} className={cardClass}>
      {children}

      {disabled ? (
        <p className="mt-4 text-sm text-zinc-400">This meetup was cancelled.</p>
      ) : (
        <>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              disabled={isPending}
              onClick={() => handleClick("going")}
              className={
                optimisticStatus === "going"
                  ? "rounded-full bg-rose-600 px-4 py-1.5 text-sm font-medium text-white shadow-sm disabled:opacity-60"
                  : "rounded-full border border-zinc-300 bg-white px-4 py-1.5 text-sm text-zinc-700 hover:border-zinc-400 disabled:opacity-60"
              }
            >
              {optimisticStatus === "going" ? "✓ Going" : "Going"}
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() => handleClick("maybe")}
              className={
                optimisticStatus === "maybe"
                  ? "rounded-full bg-zinc-900 px-4 py-1.5 text-sm font-medium text-white shadow-sm disabled:opacity-60"
                  : "rounded-full border border-zinc-300 bg-white px-4 py-1.5 text-sm text-zinc-700 hover:border-zinc-400 disabled:opacity-60"
              }
            >
              {optimisticStatus === "maybe" ? "✓ Maybe" : "Maybe"}
            </button>
          </div>
          {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
        </>
      )}
    </div>
  );
}
