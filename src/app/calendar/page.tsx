import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import MonthCalendar from "@/components/MonthCalendar";
import GroupSwitcher from "@/components/GroupSwitcher";
import EventCard from "@/components/EventCard";
import Nav from "@/components/Nav";
import type { Event, RsvpStatus } from "@/types";

function parseMonthParam(month: string | undefined): Date {
  if (month && /^\d{4}-\d{2}$/.test(month)) {
    const [y, m] = month.split("-").map(Number);
    return new Date(y, m - 1, 1);
  }
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

function monthParam(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

type AttendeeDisplay = {
  user_id: string;
  status: RsvpStatus;
  display_name: string;
  avatar_color: string;
};

export default async function CalendarPage(props: PageProps<"/calendar">) {
  const params = await props.searchParams;
  const monthDate = parseMonthParam(
    typeof params.month === "string" ? params.month : undefined,
  );
  const requestedGroup =
    typeof params.group === "string" ? params.group : undefined;
  const paramError = typeof params.error === "string" ? params.error : undefined;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Groups this user belongs to (RLS: is_member(id) or created_by = auth.uid()).
  const { data: groups } = await supabase
    .from("groups")
    .select("id, name")
    .order("created_at", { ascending: true });
  const groupList = groups ?? [];

  const activeGroupId =
    (requestedGroup && groupList.some((g) => g.id === requestedGroup)
      ? requestedGroup
      : groupList[0]?.id) ?? null;
  const activeGroupName =
    groupList.find((g) => g.id === activeGroupId)?.name ?? null;

  let activeGroupMemberIds: string[] = [];
  if (activeGroupId) {
    const { data: members } = await supabase
      .from("group_members")
      .select("user_id")
      .eq("group_id", activeGroupId);
    activeGroupMemberIds = (members ?? []).map((m) => m.user_id);
  }

  // Events in the visible month — shared calendar, visible to any signed-in user.
  const monthStart = monthDate;
  const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 1);
  const { data: events } = await supabase
    .from("events")
    .select("*")
    .gte("starts_at", monthStart.toISOString())
    .lt("starts_at", monthEnd.toISOString())
    .order("starts_at", { ascending: true });
  const eventList = (events ?? []) as Event[];

  // RSVPs for those events: RLS already limits rows to mine + anyone I share
  // a group with. Filter further to the active group's members so switching
  // groups scopes "who's going" correctly, per the README's documented pattern.
  const eventIds = eventList.map((e) => e.id);
  const rsvpsByEvent: Record<string, AttendeeDisplay[]> = {};
  const myRsvpByEvent: Record<string, RsvpStatus> = {};

  if (eventIds.length > 0) {
    const { data: rsvps } = await supabase
      .from("rsvps")
      .select("event_id, user_id, status")
      .in("event_id", eventIds);
    const rsvpRows = rsvps ?? [];

    for (const r of rsvpRows) {
      if (r.user_id === user.id) {
        myRsvpByEvent[r.event_id] = r.status as RsvpStatus;
      }
    }

    const scopedRows = rsvpRows.filter((r) =>
      activeGroupMemberIds.includes(r.user_id),
    );
    const userIds = [...new Set(scopedRows.map((r) => r.user_id))];

    const { data: profiles } = userIds.length
      ? await supabase
          .from("profiles")
          .select("id, display_name, avatar_color")
          .in("id", userIds)
      : { data: [] };
    const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));

    for (const r of scopedRows) {
      const profile = profileById.get(r.user_id);
      const list = rsvpsByEvent[r.event_id] ?? [];
      list.push({
        user_id: r.user_id,
        status: r.status as RsvpStatus,
        display_name: profile?.display_name ?? "Unknown",
        avatar_color: profile?.avatar_color ?? "#C0356E",
      });
      rsvpsByEvent[r.event_id] = list;
    }
  }

  const prevMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() - 1, 1);
  const nextMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 1);
  const groupQuery = activeGroupId ? `&group=${activeGroupId}` : "";
  const monthStr = monthParam(monthDate);

  return (
    <div className="flex flex-1 flex-col items-center px-4 py-10">
      <div className="w-full max-w-2xl">
        <Nav email={user.email ?? ""} />

        <GroupSwitcher
          groups={groupList}
          activeGroupId={activeGroupId}
          month={monthStr}
        />

        {paramError && <p className="mb-6 text-sm text-red-600">{paramError}</p>}

        <MonthCalendar
          date={monthDate}
          events={eventList}
          prevHref={`/calendar?month=${monthParam(prevMonth)}${groupQuery}`}
          nextHref={`/calendar?month=${monthParam(nextMonth)}${groupQuery}`}
        />

        <div className="mt-8 flex flex-col gap-4">
          {eventList.length === 0 && (
            <p className="text-sm text-zinc-500">No outings yet this month.</p>
          )}
          {eventList.map((event) => (
            <EventCard
              key={event.id}
              event={event}
              currentUserId={user.id}
              currentStatus={myRsvpByEvent[event.id] ?? null}
              attendees={rsvpsByEvent[event.id] ?? []}
              hasActiveGroup={Boolean(activeGroupId)}
              activeGroupName={activeGroupName}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
