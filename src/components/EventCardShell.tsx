"use client";

import { useOptimistic, useState, useTransition, type ReactNode } from "react";
import { rsvp } from "@/app/calendar/actions";
import type { RsvpStatus } from "@/types";

const STATUS_LABELS: Record<RsvpStatus, { label: string; activeLabel: string }> = {
  going: { label: "Going", activeLabel: "✓ Going" },
  maybe: { label: "Maybe", activeLabel: "✓ Maybe" },
  not_going: { label: "Not this time", activeLabel: "✓ Not this time" },
  out_sick: { label: "We're out — sick", activeLabel: "✓ We're out — sick" },
};

function buttonClass(active: boolean, muted: boolean) {
  if (active) {
    return muted
      ? "rounded-full bg-zinc-500 px-4 py-1.5 text-sm font-medium text-white shadow-sm disabled:opacity-60"
      : "rounded-full bg-rose-600 px-4 py-1.5 text-sm font-medium text-white shadow-sm disabled:opacity-60";
  }
  return "rounded-full border border-zinc-300 bg-white px-4 py-1.5 text-sm text-zinc-700 hover:border-zinc-400 disabled:opacity-60";
}

export default function EventCardShell({
  eventId,
  currentStatus,
  currentNote,
  disabled = false,
  duringNap = false,
  children,
}: {
  eventId: string;
  currentStatus: RsvpStatus | null;
  currentNote?: string | null;
  disabled?: boolean;
  duringNap?: boolean;
  children: ReactNode;
}) {
  const [optimisticStatus, setOptimisticStatus] = useOptimistic(currentStatus);
  const [note, setNote] = useState(currentNote ?? "");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick(status: RsvpStatus) {
    const next = optimisticStatus === status ? null : status;
    setError(null);
    startTransition(async () => {
      setOptimisticStatus(next);
      const result = await rsvp(eventId, next, next ? note : null);
      if (result?.error) {
        setError(result.error);
      }
    });
  }

  // Editing the note shouldn't toggle the RSVP off — save it separately
  // when the field loses focus, only if it actually changed.
  function handleNoteBlur() {
    if (!optimisticStatus) return;
    const trimmed = note.trim();
    if (trimmed === (currentNote ?? "").trim()) return;
    setError(null);
    startTransition(async () => {
      const result = await rsvp(eventId, optimisticStatus, trimmed || null);
      if (result?.error) {
        setError(result.error);
      }
    });
  }

  const baseClass = disabled
    ? "border-zinc-200 bg-zinc-50"
    : optimisticStatus === "going"
      ? "border-rose-200 bg-rose-50/60"
      : "border-zinc-200 bg-white";
  const cardClass = `scroll-mt-4 rounded-2xl border p-4 transition-colors ${baseClass} ${duringNap ? "opacity-70" : ""}`;

  return (
    <div id={`event-${eventId}`} className={cardClass}>
      {duringNap && (
        <p className="mb-2 text-xs font-medium text-zinc-500">
          🌙 During nap window
        </p>
      )}

      {children}

      {disabled ? (
        <p className="mt-4 text-sm text-zinc-400">This meetup was cancelled.</p>
      ) : (
        <>
          <div className="mt-4 flex flex-wrap gap-2">
            {(["going", "maybe", "not_going", "out_sick"] as const).map(
              (status) => {
                const active = optimisticStatus === status;
                const muted = status === "not_going" || status === "out_sick";
                return (
                  <button
                    key={status}
                    type="button"
                    disabled={isPending}
                    onClick={() => handleClick(status)}
                    className={buttonClass(active, muted)}
                  >
                    {active
                      ? STATUS_LABELS[status].activeLabel
                      : STATUS_LABELS[status].label}
                  </button>
                );
              },
            )}
          </div>

          {optimisticStatus && (
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value.slice(0, 200))}
              onBlur={handleNoteBlur}
              maxLength={200}
              placeholder="Add a short note (optional)"
              className="mt-2 w-full rounded-md border border-zinc-200 px-2.5 py-1.5 text-xs text-zinc-700 outline-none focus:border-zinc-400"
            />
          )}

          {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
        </>
      )}
    </div>
  );
}
