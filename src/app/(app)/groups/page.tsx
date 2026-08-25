import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Nav from "@/components/Nav";
import GroupMeetupPlanner from "@/components/GroupMeetupPlanner";
import { createGroup, joinGroup, updateThingsToKnow } from "./actions";
import type { GroupCandidate, GroupMember } from "@/lib/group-recommendations";

type GroupMemberDisplay = { user_id: string; display_name: string; avatar_color: string; things_to_know: string | null };

export default async function GroupsPage(props: PageProps<"/groups">) {
  const { error: paramError } = await props.searchParams;
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

  return <div className="flex flex-1 flex-col items-center px-4 py-10"><div className="w-full max-w-2xl"><Nav email={user.email ?? ""} /><h1 className="font-display mb-6 text-2xl font-bold text-zinc-900">Groups</h1>
    {groupList.map((group) => <GroupMeetupPlanner key={`planner-${group.id}`} groupName={group.name} members={recommendationMembersByGroup[group.id] ?? []} candidates={candidates} />)}
    <div className="mb-8 grid gap-6 sm:grid-cols-2"><form action={createGroup} className="flex flex-col gap-2"><label className="text-sm font-medium text-zinc-700">Create a group</label><input name="name" required placeholder="The Mommas" className="rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500" /><button type="submit" className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white">Create</button></form><form action={joinGroup} className="flex flex-col gap-2"><label className="text-sm font-medium text-zinc-700">Join a group</label><input name="code" required placeholder="Invite code" className="rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500" /><button type="submit" className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-900">Join</button></form></div>
    {paramError && <p className="mb-6 text-sm text-red-600">{paramError}</p>}
    <div className="flex flex-col gap-6">{groupList.length === 0 && <p className="text-sm text-zinc-500">You&apos;re not in any groups yet.</p>}{groupList.map((group) => { const members = membersByGroup[group.id] ?? []; const me = members.find((m) => m.user_id === user.id); return <div key={group.id} className="rounded-md border border-zinc-200 p-4"><div className="mb-2 flex items-baseline justify-between gap-2"><h2 className="text-lg font-semibold">{group.name}</h2><span className="font-mono text-xs text-zinc-500">invite code: {group.invite_code}</span></div><ul className="flex flex-col gap-2">{members.map((member) => <li key={member.user_id} className="text-sm text-zinc-700"><div className="flex items-center gap-2"><span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: member.avatar_color }} />{member.display_name}{member.user_id === user.id && <span className="text-zinc-400">(you)</span>}</div>{member.things_to_know && <p className="ml-4 mt-0.5 text-xs text-zinc-500">{member.things_to_know}</p>}</li>)}</ul><details className="mt-3 border-t border-zinc-100 pt-3"><summary className="cursor-pointer text-xs font-semibold text-zinc-500">{me?.things_to_know ? "Edit your notes for this group" : "Add notes for this group (allergies, medical, optional)"}</summary><form action={updateThingsToKnow} className="mt-2 flex flex-col gap-2"><input type="hidden" name="group_id" value={group.id} /><textarea name="things_to_know" maxLength={300} rows={2} defaultValue={me?.things_to_know ?? ""} placeholder="e.g. peanut allergy, we bring our own snacks" className="rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500" /><button type="submit" className="self-start rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white">Save</button></form></details></div>; })}</div>
  </div></div>;
}
