"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// availability has realtime enabled — rather than reimplement who_is_free's
// overlap logic client-side, just refresh the server component on any
// change in this group so it re-runs the RPC with fresh data.
export default function FreeWindowsLive({ groupId }: { groupId: string | null }) {
  const router = useRouter();

  useEffect(() => {
    if (!groupId) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`availability-group-${groupId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "availability",
          filter: `group_id=eq.${groupId}`,
        },
        () => {
          router.refresh();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [groupId, router]);

  return null;
}
