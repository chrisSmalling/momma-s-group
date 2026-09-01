"use client";

import { useEffect, useState } from "react";
import { getGroupEventAvailability } from "@/app/(app)/groups/actions";

export default function GroupAvailability({ eventId, groupId }: { eventId: string; groupId: string | null }) {
  const [data, setData] = useState<{ free: string[]; going: string[] } | null>(null);
  const [loading, setLoading] = useState(Boolean(groupId));

  useEffect(() => {
    if (!groupId) return;
    let cancelled = false;
    getGroupEventAvailability(groupId, eventId).then((result) => {
      if (cancelled) return;
      if (!result.error) setData({ free: result.free ?? [], going: result.going ?? [] });
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [eventId, groupId]);

  if (!groupId) return null;
  // Reserve the line's space while loading instead of popping in after the
  // fact and shifting everything below it.
  if (loading) return <p className="mt-2 text-sm font-medium text-zinc-500">Checking who&apos;s free…</p>;
  if (!data || (data.free.length === 0 && data.going.length === 0)) return null;
  const names = data.free.slice(0, 3).join(", ");
  // "Free" here is a member's own marked-free window on the /free page —
  // distinct from an RSVP, so say so rather than leaving "free" ambiguous.
  return <p className="mt-2 text-sm font-medium text-emerald-700">{names ? `${names} marked ${data.free.length === 1 ? "themself" : "themselves"} free for this time` : "Your group has people going"}{data.free.length > 3 ? ` +${data.free.length - 3}` : ""}</p>;
}
