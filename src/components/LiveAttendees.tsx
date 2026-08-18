"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import GoingAvatars from "@/components/GoingAvatars";
import type { RsvpStatus } from "@/types";

type Attendee = {
  user_id: string;
  status: RsvpStatus;
  display_name: string;
  avatar_color: string;
};

type Roster = Record<string, { display_name: string; avatar_color: string }>;

export default function LiveAttendees({
  eventId,
  currentUserId,
  hasActiveGroup,
  activeGroupName,
  activeGroupMemberIds,
  roster,
  initialAttendees,
}: {
  eventId: string;
  currentUserId: string;
  hasActiveGroup: boolean;
  activeGroupName: string | null;
  activeGroupMemberIds: string[];
  roster: Roster;
  initialAttendees: Attendee[];
}) {
  const [attendees, setAttendees] = useState<Attendee[]>(initialAttendees);

  // Refs so the subscription callback always sees fresh values without
  // needing to tear down and resubscribe when these props' identity changes
  // on every parent server-render.
  const memberIdsRef = useRef(activeGroupMemberIds);
  const rosterRef = useRef(roster);
  useEffect(() => {
    memberIdsRef.current = activeGroupMemberIds;
    rosterRef.current = roster;
  }, [activeGroupMemberIds, roster]);

  useEffect(() => {
    if (!hasActiveGroup) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`rsvps-event-${eventId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "rsvps",
          filter: `event_id=eq.${eventId}`,
        },
        (payload) => {
          if (payload.eventType === "DELETE") {
            const oldRow = payload.old as { user_id: string };
            setAttendees((prev) =>
              prev.filter((a) => a.user_id !== oldRow.user_id),
            );
            return;
          }
          const row = payload.new as { user_id: string; status: RsvpStatus };
          if (!memberIdsRef.current.includes(row.user_id)) return;
          const profile = rosterRef.current[row.user_id];
          setAttendees((prev) => [
            ...prev.filter((a) => a.user_id !== row.user_id),
            {
              user_id: row.user_id,
              status: row.status,
              display_name: profile?.display_name ?? "Someone",
              avatar_color: profile?.avatar_color ?? "#C0356E",
            },
          ]);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [eventId, hasActiveGroup]);

  const going = attendees.filter((a) => a.status === "going");
  const maybe = attendees.filter((a) => a.status === "maybe");

  return (
    <div>
      <GoingAvatars
        going={going}
        currentUserId={currentUserId}
        groupName={activeGroupName}
        hasActiveGroup={hasActiveGroup}
      />
      {maybe.length > 0 && (
        <p className="mt-1.5 text-xs text-zinc-400">
          Maybe:{" "}
          {maybe
            .map((p) =>
              p.user_id === currentUserId
                ? `${p.display_name} (you)`
                : p.display_name,
            )
            .join(", ")}
        </p>
      )}
    </div>
  );
}
