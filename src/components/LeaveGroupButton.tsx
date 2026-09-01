"use client";

import { useState, useTransition } from "react";
import { leaveGroup } from "@/app/(app)/groups/actions";

export default function LeaveGroupButton({ groupId, groupName }: { groupId: string; groupName: string }) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleLeave() {
    setError(null);
    startTransition(async () => {
      const result = await leaveGroup(groupId);
      if (result?.error) {
        setError(result.error);
        setConfirming(false);
      }
      // On success the group card disappears on revalidate — nothing else to reset.
    });
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="inline-flex min-h-11 items-center rounded-full px-3 text-xs font-semibold text-zinc-500 hover:bg-rose-50 hover:text-rose-700"
      >
        Leave group
      </button>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold text-rose-800">Leave {groupName}?</span>
        <button
          type="button"
          onClick={handleLeave}
          disabled={isPending}
          className="inline-flex min-h-11 items-center rounded-full bg-rose-600 px-3 text-xs font-bold text-white hover:bg-rose-700 disabled:opacity-60"
        >
          {isPending ? "Leaving…" : "Yes, leave"}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          disabled={isPending}
          className="inline-flex min-h-11 items-center rounded-full px-3 text-xs font-semibold text-zinc-600 hover:bg-zinc-50"
        >
          Cancel
        </button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
