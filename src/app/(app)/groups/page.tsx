import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import Nav from "@/components/Nav";
import GroupInvite from "@/components/GroupInvite";
import GroupMeetupPlanner from "@/components/GroupMeetupPlanner";
import { createGroup, joinGroup, updateThingsToKnow } from "./actions";
import type { GroupCandidate, GroupMember } from "@/lib/group-recommendations";

type GroupMemberDisplay = { user_id: string; display_name: string; avatar_color: string; things_to_know: string | null };

export default async function GroupsPage(props: PageProps<"/groups">) {
  const { error: paramError, invite } = await props.searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: groups } = await supabase.from("groups").select("id, name, invite_code, created_by, created_at").order("created_at", { ascending: true });
  const groupList = groups ?? [];
  const groupIds = groupList.map((g) => g.id);
  const membersByGroup: Record<string, GroupMemberDisplay[]> = {};
  const recommendationMembersByGroup: Record<string, GroupMember[]> = {};

  if (groupIds.length > 0) {
    const { data: members } = await supabase.from("group_members").select("group_id, user_id, things_to_know").in("group_id", groupIds);
    const memberRows = members ?? [];
    const userIds = [...new Set(memberRows.map((m) => m.user_id))];
    const { data: profiles } = userIds.length ? await supabase.from("profiles").select("id, display_name, avatar_color, child_age_months, home_lat, home_lng").in("id", userIds) : { data: [] };
    const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));
    for (const member of memberRows) {
      const profile = profileById.get(member.user_id);
      const list = membersByGroup[member.group_id] ?? [];
      list.push({ user_id: member.user_id, display_name: profile?.display_name ?? "Unknown", avatar_color: profile?.avatar_color ?? "#C0356E", things_to_know: member.things_to_know ?? null });
      membersByGroup[member.group_id] = list;
      const recommendationList = recommendationMembersByGroup[member.group_id] ?? [];
      recommendationList.push({ id: member.user_id, children: profile?.child_age_months != null ? [{ ageMonths: profile.child_age_months }] : [], homeLat: profile?.home_lat ?? null, homeLng: profile?.home_lng ?? null });
      recommendationMembersByGroup[member.group_id] = recommendationList;
    }
  }

  const { data: places } = await supabase.from("places").select("id, name, is_outdoor, lat, lng, age_min_months, age_max_months, price_note, has_changing_table, restrooms, stroller_accessible, is_enclosed").eq("active", true);
  const candidates: GroupCandidate[] = (places ?? []).map((p) => ({ id: p.id, name: p.name, isOutdoor: p.is_outdoor, lat: p.lat, lng: p.lng, ageMinMonths: p.age_min_months, ageMaxMonths: p.age_max_months, priceText: p.price_note, hasChangingTable: p.has_changing_table, restrooms: p.restrooms, strollerAccessible: p.stroller_accessible, enclosed: p.is_enclosed }));

  return (
    <div className="flex flex-1 flex-col items-center px-4 py-6 sm:py-10">
      <div className="w-full max-w-2xl">
        <Nav email={user.email ?? ""} />
        <div className="mb-6">
          <h1 className="font-display text-2xl font-bold tracking-tight text-zinc-950">Groups</h1>
          <p className="mt-1 text-sm text-zinc-500">See who&apos;s in, plan something together, and keep the little details in one place.</p>
        </div>

        {invite && <section className="mb-6 rounded-3xl border border-rose-200 bg-rose-50 p-4 shadow-sm"><div className="text-sm font-extrabold uppercase tracking-wide text-rose-700">You&apos;ve been invited</div><h2 className="mt-1 font-display text-xl font-bold text-zinc-950">Join a Momma&apos;s Meetup group</h2><p className="mt-1 text-sm text-zinc-600">Enter the invite code below to join. You&apos;ll then see the group&apos;s plans and receive notifications when another mom proposes a meetup.</p><form action={joinGroup} className="mt-3 flex gap-2"><input type="hidden" name="code" value={invite} /><div className="flex min-h-11 flex-1 items-center rounded-xl border border-zinc-200 bg-white px-3 font-mono text-sm font-bold tracking-wider">{invite}</div><button type="submit" className="min-h-11 rounded-xl bg-zinc-900 px-4 py-2 text-sm font-bold text-white">Join</button></form></section>}

        {groupList.length > 0 && (
          <Link href="/plans" className="mb-6 flex items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3.5 shadow-sm transition hover:border-rose-300">
            <div><div className="font-display text-base font-bold text-zinc-950">What we&apos;re up to →</div><p className="mt-0.5 text-xs text-zinc-600">See what your group&apos;s already committed to this month.</p></div><span aria-hidden="true" className="text-lg font-semibold text-rose-600">→</span>
          </Link>
        )}

        {groupList.map((group) => <GroupMeetupPlanner key={`planner-${group.id}`} groupName={group.name} members={recommendationMembersByGroup[group.id] ?? []} candidates={candidates} />)}

        <section aria-label="Group actions" className="mb-8 rounded-3xl border border-rose-100 bg-gradient-to-br from-rose-50 via-white to-amber-50 p-4 shadow-sm sm:p-5">
          <div className="mb-4"><h2 className="font-display text-lg font-bold text-zinc-950">Grow your group</h2><p className="mt-1 text-xs text-zinc-500">Invite moms with one tap, or join another group with a code.</p></div>
          {groupList.length > 0 && <div className="mb-4 space-y-3">{groupList.map((group) => <GroupInvite key={`invite-${group.id}`} groupName={group.name} inviteCode={group.invite_code} />)}</div>}
          <div className="grid gap-3 sm:grid-cols-2">
            <form action={createGroup} className="rounded-2xl border border-white bg-white/90 p-4 shadow-sm"><label className="text-sm font-bold text-zinc-800">Create a group</label><input name="name" required placeholder="The Mommas" className="mt-2 min-h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100" /><button type="submit" className="mt-2 min-h-11 w-full rounded-xl bg-zinc-900 px-3 py-2 text-sm font-bold text-white">Create group</button></form>
            <form action={joinGroup} className="rounded-2xl border border-white bg-white/90 p-4 shadow-sm"><label className="text-sm font-bold text-zinc-800">Join a group</label><input name="code" required placeholder="Enter invite code" autoCapitalize="characters" className="mt-2 min-h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm uppercase tracking-wider outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100" /><button type="submit" className="mt-2 min-h-11 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm font-bold text-zinc-900">Join group</button></form>
          </div>
        </section>

        {paramError && <p role="alert" className="mb-6 rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{paramError}</p>}

        <section aria-label="Your groups" className="flex flex-col gap-4">
          {groupList.length === 0 && <div className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 p-5 text-sm text-zinc-600">You&apos;re not in any groups yet. Create one above or join with an invite code.</div>}
          {groupList.map((group) => { const members = membersByGroup[group.id] ?? []; const me = members.find((m) => m.user_id === user.id); return <article key={group.id} className="rounded-3xl border border-zinc-200/80 bg-white p-4 shadow-sm sm:p-5"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><h2 className="font-display text-xl font-bold text-zinc-950">{group.name}</h2><p className="mt-1 text-xs text-zinc-500">{members.length} member{members.length === 1 ? "" : "s"}</p></div><div className="rounded-xl bg-zinc-50 px-3 py-2 text-left ring-1 ring-zinc-100"><div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Invite code</div><div className="mt-0.5 font-mono text-sm font-bold tracking-wider text-zinc-800">{group.invite_code}</div></div></div><ul className="mt-4 divide-y divide-zinc-100 rounded-2xl border border-zinc-100" aria-label={`${group.name} members`}>{members.map((member) => <li key={member.user_id} className="flex items-start gap-3 px-3 py-3"><span aria-hidden="true" className="mt-1 h-3 w-3 shrink-0 rounded-full ring-2 ring-white" style={{ backgroundColor: member.avatar_color }} /><div className="min-w-0"><div className="text-sm font-semibold text-zinc-800">{member.display_name}{member.user_id === user.id && <span className="ml-1.5 font-medium text-zinc-400">(you)</span>}</div>{member.things_to_know && <p className="mt-0.5 text-xs leading-5 text-zinc-500">{member.things_to_know}</p>}</div></li>)}</ul><details className="mt-4 border-t border-zinc-100 pt-3"><summary className="flex min-h-11 cursor-pointer items-center justify-between text-sm font-bold text-zinc-600"><span>{me?.things_to_know ? "Edit your notes for this group" : "Add notes for this group"}</span><span aria-hidden="true">⌄</span></summary><p className="mb-2 text-xs text-zinc-500">Optional notes other group members may need to know.</p><form action={updateThingsToKnow} className="flex flex-col gap-2"><input type="hidden" name="group_id" value={group.id} /><textarea name="things_to_know" maxLength={300} rows={2} defaultValue={me?.things_to_know ?? ""} placeholder="Anything helpful for the group" className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100" /><button type="submit" className="min-h-11 self-start rounded-xl bg-zinc-900 px-4 py-2 text-sm font-bold text-white">Save notes</button></form></details></article>; })}
        </section>
      </div>
    </div>
  );
}
