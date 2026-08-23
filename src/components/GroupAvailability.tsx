"use client";

import { useEffect, useState } from "react";
import { getGroupEventAvailability } from "@/app/groups/actions";

export default function GroupAvailability({ eventId, groupId }: { eventId: string; groupId: string | null }) {
  const [data, setData] = useState<{ free: string[]; going: string[] } | null>(null);

  useEffect(() => {
    if (!groupId) return;
    let cancelled = false;
    getGroupEventAvailability(groupId, eventId).then((result) => {
      if (!cancelled && !result.error) setData({ free: result.free ?? [], going: result.going ?? [] });
    });
    return () => { cancelled = true; };
  }, [eventId, groupId]);

  if (!groupId || !data || (data.free.length === 0 && data.going.length === 0)) return null;
  const names = data.free.slice(0, 3).join(", ");
  return <p className="mt-2 text-sm font-medium text-emerald-700">{names ? `${names} ${data.free.length === 1 ? "is" : "are"} free` : "Your group has people going"}{data.free.length > 3 ? ` +${data.free.length - 3}` : ""}</p>;
}
