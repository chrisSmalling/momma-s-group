"use client";

import { useState, useTransition } from "react";
import { askGroupAboutEvent } from "@/app/(app)/groups/actions";

export default function AskGroupButton({ eventId, groupId, groupName }: { eventId: string; groupId: string | null; groupName: string | null }) {
  const [asked, setAsked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!groupId) return null;
  const activeGroupId = groupId;

  function handleAsk() {
    setError(null);
    startTransition(async () => {
      const result = await askGroupAboutEvent(activeGroupId, eventId);
      if (result?.error) setError(result.error);
      else setAsked(true);
    });
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <button type="button" onClick={handleAsk} disabled={isPending || asked} className={asked ? "rounded-full bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700" : "rounded-full border border-rose-200 bg-white px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-60"}>
        {asked ? "✓ Asked the group" : `Ask ${groupName ?? "the group"}`}
      </button>
      {asked && <span className="text-xs text-zinc-500">Your group can now respond from the meetup.</span>}
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
