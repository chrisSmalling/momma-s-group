import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import Nav from "@/components/Nav";
import CommitmentCard from "@/components/CommitmentCard";
import type { FeedEvent, RsvpStatus, VenuePracticalities } from "@/types";

const PLACE_CONTEXT_COLUMNS = "id, is_enclosed, has_changing_table, nursing_friendly, stroller_accessible, food_onsite, quiet_or_sensory_friendly";
const WINDOW_DAYS = 30;

type Person = { user_id: string; display_name: string; avatar_color: string };
type Committed = { event: FeedEvent; place: VenuePracticalities | null; going: Person[]; maybe: Person[]; currentStatus: RsvpStatus | null };
type Planned = { event: FeedEvent; place: VenuePracticalities | null; proposedByName: string };

export default async function PlansPage(props: PageProps<"/plans">) {
  const searchParams = await props.searchParams;
  const requestedGroup = typeof searchParams.group === "string" ? searchParams.group : undefined;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: myProfile } = await supabase.from("profiles").select("display_name, avatar_color").eq("id", user.id).maybeSingle();
  const currentUserName = myProfile?.display_name ?? "You";

  const { data: groups } = await supabase.from("groups").select("id, name").order("created_at", { ascending: true });
  const groupList = groups ?? [];
  const activeGroupId = (requestedGroup && groupList.some((g) => g.id === requestedGroup) ? requestedGroup : groupList[0]?.id) ?? null;
  const activeGroupName = groupList.find((g) => g.id === activeGroupId)?.name ?? null;

  if (!activeGroupId) {
    return (
      <div className="flex flex-1 flex-col items-center px-4 py-10">
        <div className="w-full max-w-2xl">
          <Nav email={user.email ?? ""} />
          <h1 className="font-display mb-1 text-2xl font-bold text-zinc-900">What we&apos;re up to</h1>
          <p className="rounded-xl border border-dashed border-zinc-200 px-4 py-5 text-sm text-zinc-500">
            You&apos;re not in any groups yet — <Link href="/groups" className="underline">create or join one</Link> to see what everyone&apos;s already committed to.
          </p>
        </div>
      </div>
    );
  }

  const { data: members } = await supabase.from("group_members").select("user_id").eq("group_id", activeGroupId);
  const memberIds = (members ?? []).map((m) => m.user_id);

  const now = new Date();
  const horizon = new Date(now.getTime() + WINDOW_DAYS * 864e5);
  const { data: upcomingEvents } = await supabase
    .from("feed_events")
    .select("*")
    .gte("starts_at", now.toISOString())
    .lte("starts_at", horizon.toISOString())
    .order("starts_at", { ascending: true });
  const eventList = (upcomingEvents ?? []) as FeedEvent[];
  const eventIds = eventList.map((e) => e.id);

  const { data: rsvpRows } = eventIds.length && memberIds.length
    ? await supabase.from("rsvps").select("event_id, user_id, status").in("event_id", eventIds).in("user_id", memberIds).in("status", ["going", "maybe"])
    : { data: [] };
  const rsvps = rsvpRows ?? [];

  const { data: profiles } = memberIds.length ? await supabase.from("profiles").select("id, display_name, avatar_color").in("id", memberIds) : { data: [] };
  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));

  const placeIds = [...new Set(eventList.map((e) => e.place_id).filter((id): id is string => Boolean(id)))];
  const { data: placeRows } = placeIds.length ? await supabase.from("places").select(PLACE_CONTEXT_COLUMNS).in("id", placeIds) : { data: [] };
  const placeById = new Map((placeRows ?? []).map((p) => [p.id, p as VenuePracticalities]));

  const goingByEvent = new Map<string, Person[]>();
  const maybeByEvent = new Map<string, Person[]>();
  const myStatusByEvent = new Map<string, RsvpStatus>();
  for (const r of rsvps) {
    const profile = profileById.get(r.user_id);
    const person: Person = { user_id: r.user_id, display_name: profile?.display_name ?? "Someone", avatar_color: profile?.avatar_color ?? "#C0356E" };
    if (r.user_id === user.id) myStatusByEvent.set(r.event_id, r.status as RsvpStatus);
    if (r.status === "going") { const list = goingByEvent.get(r.event_id) ?? []; list.push(person); goingByEvent.set(r.event_id, list); }
    else if (r.status === "maybe") { const list = maybeByEvent.get(r.event_id) ?? []; list.push(person); maybeByEvent.set(r.event_id, list); }
  }

  const committed: Committed[] = eventList
    .filter((e) => (goingByEvent.get(e.id) ?? []).length > 0)
    .map((event) => ({
      event,
      place: event.place_id ? (placeById.get(event.place_id) ?? null) : null,
      going: goingByEvent.get(event.id) ?? [],
      maybe: maybeByEvent.get(event.id) ?? [],
      currentStatus: myStatusByEvent.get(event.id) ?? null,
    }))
    .sort((a, b) => {
      const dateDiff = new Date(a.event.starts_at).getTime() - new Date(b.event.starts_at).getTime();
      if (dateDiff !== 0) return dateDiff;
      return b.going.length - a.going.length;
    });

  // "Being planned": proposed_by_group events (see proposeMeetup in
  // places/actions.ts — a proposal is a real events row, not a
  // group_event_plans row, which exists in the schema but has no writer
  // anywhere in the app) that nobody's committed to yet.
  const planned: Planned[] = eventList
    .filter((e) => e.proposed_by_group === activeGroupId && (goingByEvent.get(e.id) ?? []).length === 0 && e.added_by)
    .map((event) => ({
      event,
      place: event.place_id ? (placeById.get(event.place_id) ?? null) : null,
      proposedByName: profileById.get(event.added_by as string)?.display_name ?? "Someone",
    }));

  return (
    <div className="flex flex-1 flex-col items-center px-4 py-10">
      <div className="w-full max-w-2xl">
        <Nav email={user.email ?? ""} />

        <h1 className="font-display mb-1 text-2xl font-bold text-zinc-900">What we&apos;re up to</h1>
        <p className="mb-6 text-sm text-zinc-500">What {activeGroupName ?? "your group"} is already committed to, next {WINDOW_DAYS} days.</p>

        {groupList.length > 1 && (
          <div className="mb-6 flex flex-wrap items-center gap-2 text-sm">
            <span className="text-zinc-500">Group:</span>
            {groupList.map((g) => (
              <Link key={g.id} href={`/plans?group=${g.id}`} className={g.id === activeGroupId ? "rounded-full bg-zinc-900 px-3 py-1 font-medium text-white" : "rounded-full border border-zinc-300 px-3 py-1 text-zinc-700 hover:border-zinc-500"}>
                {g.name}
              </Link>
            ))}
          </div>
        )}

        {memberIds.length <= 1 && (
          <p className="mb-6 rounded-xl bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
            It&apos;s just you in {activeGroupName ?? "this group"} so far — this view is a lot more useful with company.{" "}
            <Link href="/groups" className="underline">Invite someone</Link> to see it fill in.
          </p>
        )}

        {committed.length === 0 ? (
          <div className="mb-8 rounded-xl border border-dashed border-zinc-200 px-4 py-5 text-sm text-zinc-500">
            Nobody&apos;s locked anything in yet this week.{" "}
            <Link href="/today" className="underline">Check Today</Link> or <Link href="/places" className="underline">Explore</Link> to propose something.
          </div>
        ) : (
          <section className="mb-8">
            <h2 className="font-display mb-3 text-lg font-bold text-zinc-900">Committed</h2>
            <div className="flex flex-col gap-4">
              {committed.map((c) => (
                <CommitmentCard
                  key={c.event.id}
                  event={c.event}
                  place={c.place}
                  going={c.going}
                  maybe={c.maybe}
                  memberCount={memberIds.length}
                  currentUserId={user.id}
                  currentUserName={currentUserName}
                  currentStatus={c.currentStatus}
                  groupName={activeGroupName}
                />
              ))}
            </div>
          </section>
        )}

        {planned.length > 0 && (
          <section>
            <h2 className="font-display mb-3 text-lg font-bold text-zinc-900">Being planned</h2>
            <div className="flex flex-col gap-4">
              {planned.map((p) => (
                <CommitmentCard
                  key={p.event.id}
                  event={p.event}
                  place={p.place}
                  going={[]}
                  maybe={[]}
                  memberCount={memberIds.length}
                  currentUserId={user.id}
                  currentUserName={currentUserName}
                  currentStatus={null}
                  groupName={activeGroupName}
                  proposedByName={p.proposedByName}
                />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
