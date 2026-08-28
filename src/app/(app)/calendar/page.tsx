import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { createClient } from "@/lib/supabase/server";
import { monthParam } from "@/lib/date";
import { overlapsNapWindow } from "@/lib/nap";
import MonthCalendar from "@/components/MonthCalendar";
import GroupSwitcher from "@/components/GroupSwitcher";
import EventCard from "@/components/EventCard";
import Nav from "@/components/Nav";
import type {
  CancelledUpcoming,
  FeedEvent,
  EventComment,
  Place,
  PlaceTip,
  RsvpStatus,
} from "@/types";

function parseMonthParam(month: string | undefined): Date {
  if (month && /^\d{4}-\d{2}$/.test(month)) {
    const [y, m] = month.split("-").map(Number);
    return new Date(y, m - 1, 1);
  }
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

type AttendeeDisplay = {
  user_id: string;
  status: RsvpStatus;
  display_name: string;
  avatar_color: string;
};

const PLACE_CONTEXT_COLUMNS =
  "id, is_enclosed, has_changing_table, nursing_friendly, stroller_accessible, food_onsite, quiet_or_sensory_friendly, parking_notes, best_time_note, typical_crowd_note, what_to_bring";

export default async function CalendarPage(props: PageProps<"/calendar">) {
  const params = await props.searchParams;
  const monthDate = parseMonthParam(
    typeof params.month === "string" ? params.month : undefined,
  );
  // The canonical "YYYY-MM" for the visible month. monthDate itself must
  // never cross into MonthCalendar (a client component) — its
  // getFullYear()/getMonth() read the server's local zone (UTC on Vercel),
  // which the browser re-derives in the viewer's own zone and can land on
  // the wrong month entirely. year/month0 below are the primitives that
  // actually get passed down.
  const monthStr = monthParam(monthDate);
  const [yy, mmOneBased] = monthStr.split("-").map(Number);
  const month0 = mmOneBased - 1;
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

  const { data: myProfile } = await supabase
    .from("profiles")
    .select("display_name, nap_start, nap_end, child_age_months")
    .eq("id", user.id)
    .maybeSingle();
  const currentUserName = myProfile?.display_name ?? "You";

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

  // Events in the visible month. RLS already limits proposed meetups
  // (proposed_by_group set) to members of that group; curated/materialized
  // events (proposed_by_group null) are visible to everyone.
  // The query range is a deliberately loose superset (padded a day on each
  // side) of the ET month — MonthCalendar's Eastern-calendar-date placement
  // below is what's authoritative for which grid cell an event lands in, so
  // it's safe (and necessary, given UTC/ET offset) to over-fetch here rather
  // than risk excluding an event that's in-month in ET but not in UTC.
  const rangeStart = new Date(Date.UTC(yy, month0, 1));
  rangeStart.setUTCDate(rangeStart.getUTCDate() - 1);
  const rangeEnd = new Date(Date.UTC(yy, month0 + 1, 1));
  rangeEnd.setUTCDate(rangeEnd.getUTCDate() + 1);
  // public.feed_events already applies status='published' AND
  // is_kid_relevant AND NOT is_suppressed AND duplicate_of IS NULL —
  // don't hand-filter events here, query the view directly.
  const { data: events } = await supabase
    .from("feed_events")
    .select("*")
    .gte("starts_at", rangeStart.toISOString())
    .lt("starts_at", rangeEnd.toISOString())
    .order("starts_at", { ascending: true });
  const eventList = (events ?? []) as FeedEvent[];
  const eventIds = eventList.map((e) => e.id);

  // RSVPs for those events: RLS already limits rows to mine + anyone I share
  // a group with. Filter further to the active group's members so switching
  // groups scopes "who's going" correctly, per the README's documented pattern.
  const { data: rsvps } = eventIds.length
    ? await supabase
        .from("rsvps")
        .select("event_id, user_id, status, note")
        .in("event_id", eventIds)
    : { data: [] };
  const rsvpRows = rsvps ?? [];

  const myRsvpByEvent: Record<string, RsvpStatus> = {};
  const myNoteByEvent: Record<string, string | null> = {};
  for (const r of rsvpRows) {
    if (r.user_id === user.id) {
      myRsvpByEvent[r.event_id] = r.status as RsvpStatus;
      myNoteByEvent[r.event_id] = r.note ?? null;
    }
  }
  const scopedRsvpRows = rsvpRows.filter((r) =>
    activeGroupMemberIds.includes(r.user_id),
  );

  // Comments + tips for this month's events, scoped to the active group.
  const { data: comments } =
    activeGroupId && eventIds.length
      ? await supabase
          .from("event_comments")
          .select("*")
          .eq("group_id", activeGroupId)
          .in("event_id", eventIds)
          .order("created_at", { ascending: true })
      : { data: [] };
  const commentRows = (comments ?? []) as EventComment[];

  const placeIds = [
    ...new Set(eventList.map((e) => e.place_id).filter((id): id is string => Boolean(id))),
  ];
  const eventIdsWithoutPlace = eventList
    .filter((e) => !e.place_id)
    .map((e) => e.id);

  const [{ data: tipsByPlace }, { data: tipsByEvent }] = await Promise.all([
    activeGroupId && placeIds.length
      ? supabase
          .from("place_tips")
          .select("*")
          .eq("group_id", activeGroupId)
          .in("place_id", placeIds)
      : Promise.resolve({ data: [] as PlaceTip[] }),
    activeGroupId && eventIdsWithoutPlace.length
      ? supabase
          .from("place_tips")
          .select("*")
          .eq("group_id", activeGroupId)
          .in("event_id", eventIdsWithoutPlace)
      : Promise.resolve({ data: [] as PlaceTip[] }),
  ]);
  const tipRows = [...(tipsByPlace ?? []), ...(tipsByEvent ?? [])] as PlaceTip[];

  // Places linked to this month's events, for venue-practicality context.
  const { data: places } = placeIds.length
    ? await supabase.from("places").select(PLACE_CONTEXT_COLUMNS).in("id", placeIds)
    : { data: [] };
  const placeById = new Map((places ?? []).map((p) => [p.id, p as Partial<Place>]));

  // Every profile we might need to render a name for: active-group roster
  // (so LiveAttendees can resolve new realtime RSVPs), proposers, commenters,
  // tip authors.
  const proposerIds = eventList
    .filter((e) => e.proposed_by_group && e.added_by)
    .map((e) => e.added_by as string);
  const profileIds = [
    ...new Set([
      ...activeGroupMemberIds,
      ...scopedRsvpRows.map((r) => r.user_id),
      ...proposerIds,
      ...commentRows.map((c) => c.user_id),
      ...tipRows.map((t) => t.user_id),
    ]),
  ];

  const { data: profiles } = profileIds.length
    ? await supabase
        .from("profiles")
        .select("id, display_name, avatar_color")
        .in("id", profileIds)
    : { data: [] };
  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));
  const roster = Object.fromEntries(
    activeGroupMemberIds.map((id) => [
      id,
      {
        display_name: profileById.get(id)?.display_name ?? "Someone",
        avatar_color: profileById.get(id)?.avatar_color ?? "#C0356E",
      },
    ]),
  );

  const rsvpsByEvent: Record<string, AttendeeDisplay[]> = {};
  for (const r of scopedRsvpRows) {
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

  const commentsByEvent: Record<string, (EventComment & { display_name: string })[]> = {};
  for (const c of commentRows) {
    const list = commentsByEvent[c.event_id] ?? [];
    list.push({ ...c, display_name: profileById.get(c.user_id)?.display_name ?? "Someone" });
    commentsByEvent[c.event_id] = list;
  }

  const tipsByPlaceId: Record<string, (PlaceTip & { display_name: string })[]> = {};
  const tipsByEventId: Record<string, (PlaceTip & { display_name: string })[]> = {};
  for (const t of tipRows) {
    const display = { ...t, display_name: profileById.get(t.user_id)?.display_name ?? "Someone" };
    if (t.place_id) {
      const list = tipsByPlaceId[t.place_id] ?? [];
      list.push(display);
      tipsByPlaceId[t.place_id] = list;
    } else if (t.event_id) {
      const list = tipsByEventId[t.event_id] ?? [];
      list.push(display);
      tipsByEventId[t.event_id] = list;
    }
  }

  // NOTE: my_cancelled_upcoming is not self-scoping (see db/schema.sql) —
  // the .eq("user_id", ...) below is load-bearing, not defensive belt-and-suspenders.
  const { data: cancelledUpcoming } = await supabase
    .from("my_cancelled_upcoming")
    .select("*")
    .eq("user_id", user.id)
    .order("starts_at", { ascending: true });
  const cancelledUpcomingList = (cancelledUpcoming ?? []) as CancelledUpcoming[];

  const prevMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() - 1, 1);
  const nextMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 1);
  const groupQuery = activeGroupId ? `&group=${activeGroupId}` : "";

  // The Calendar's "Group" mode: any event an active-group member is
  // going/maybe to. rsvpRows already carries everyone I share a group with
  // (RLS), so this is a filter over data already fetched, not a new query.
  const groupEventIds = [
    ...new Set(
      rsvpRows
        .filter(
          (r) =>
            activeGroupMemberIds.includes(r.user_id) &&
            (r.status === "going" || r.status === "maybe"),
        )
        .map((r) => r.event_id),
    ),
  ];

  // Built once here and handed to MonthCalendar as pre-rendered nodes so its
  // client-side search/filter/day-selection state has a single set of full
  // detail cards to show — not a second, always-unfiltered feed underneath.
  const cards: Record<string, ReactNode> = {};
  for (const event of eventList) {
    const proposedBy =
      event.proposed_by_group && event.added_by
        ? {
            user_id: event.added_by,
            display_name: profileById.get(event.added_by)?.display_name ?? "Someone",
          }
        : null;

    const place = event.place_id ? (placeById.get(event.place_id) ?? null) : null;

    const duringNap = overlapsNapWindow(
      event.starts_at,
      event.ends_at,
      myProfile?.nap_start ?? null,
      myProfile?.nap_end ?? null,
    );

    const tips = event.place_id ? (tipsByPlaceId[event.place_id] ?? []) : (tipsByEventId[event.id] ?? []);

    cards[event.id] = (
      <EventCard
        key={event.id}
        event={event}
        currentUserId={user.id}
        currentUserName={currentUserName}
        currentStatus={myRsvpByEvent[event.id] ?? null}
        currentNote={myNoteByEvent[event.id] ?? null}
        attendees={rsvpsByEvent[event.id] ?? []}
        hasActiveGroup={Boolean(activeGroupId)}
        activeGroupId={activeGroupId}
        activeGroupName={activeGroupName}
        activeGroupMemberIds={activeGroupMemberIds}
        roster={roster}
        proposedBy={proposedBy}
        place={place as EventCardPlace | null}
        duringNap={duringNap}
        comments={commentsByEvent[event.id] ?? []}
        tips={tips}
        childAgeMonths={myProfile?.child_age_months ?? null}
      />
    );
  }

  return (
    <div className="flex flex-1 flex-col items-center px-4 py-10">
      <div className="w-full max-w-2xl">
        <Nav email={user.email ?? ""} />

        {cancelledUpcomingList.length > 0 && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4">
            <p className="mb-2 text-sm font-semibold text-red-800">
              {cancelledUpcomingList.length === 1
                ? "An event you're going to was cancelled"
                : `${cancelledUpcomingList.length} events you're going to were cancelled`}
            </p>
            <ul className="flex flex-col gap-1">
              {cancelledUpcomingList.map((c) => (
                <li key={c.event_id} className="text-sm text-red-700">
                  <a href={`/events/${c.event_id}`} className="underline">
                    {c.title}
                  </a>{" "}
                  —{" "}
                  {new Date(c.starts_at).toLocaleDateString(undefined, {
                    timeZone: "America/New_York",
                    month: "short",
                    day: "numeric",
                  })}
                </li>
              ))}
            </ul>
          </div>
        )}

        <GroupSwitcher
          groups={groupList}
          activeGroupId={activeGroupId}
          month={monthStr}
        />

        {paramError && <p className="mb-6 text-sm text-red-600">{paramError}</p>}

        <MonthCalendar
          year={yy}
          month0={month0}
          events={eventList}
          prevHref={`/calendar?month=${monthParam(prevMonth)}${groupQuery}`}
          nextHref={`/calendar?month=${monthParam(nextMonth)}${groupQuery}`}
          cards={cards}
          myRsvpByEvent={myRsvpByEvent}
          activeGroupId={activeGroupId}
          childAgeMonths={myProfile?.child_age_months ?? null}
          plansHref={activeGroupId ? `/plans?group=${activeGroupId}` : "/plans"}
          groupEventIds={groupEventIds}
          currentUserId={user.id}
        />
      </div>
    </div>
  );
}

type EventCardPlace = {
  is_enclosed: boolean | null;
  has_changing_table: boolean | null;
  nursing_friendly: boolean | null;
  stroller_accessible: boolean | null;
  food_onsite: boolean | null;
  quiet_or_sensory_friendly: boolean | null;
  parking_notes: string | null;
  best_time_note: string | null;
  typical_crowd_note: string | null;
  what_to_bring: string[];
};
