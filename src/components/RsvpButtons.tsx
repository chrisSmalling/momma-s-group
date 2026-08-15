"use client";

import { useOptimistic, useState, useTransition } from "react";
import { rsvp } from "@/app/calendar/actions";
import type { RsvpStatus } from "@/types";

export default function RsvpButtons({
  eventId,
  currentStatus,
}: {
  eventId: string;
  currentStatus: RsvpStatus | null;
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

  return (
    <div className="mb-3 flex flex-col gap-1">
      <div className="flex gap-2">
        <button
          type="button"
          disabled={isPending}
          onClick={() => handleClick("going")}
          className={
            optimisticStatus === "going"
              ? "rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60"
              : "rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 hover:border-zinc-500 disabled:opacity-60"
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
              ? "rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60"
              : "rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 hover:border-zinc-500 disabled:opacity-60"
          }
        >
          {optimisticStatus === "maybe" ? "✓ Maybe" : "Maybe"}
        </button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
