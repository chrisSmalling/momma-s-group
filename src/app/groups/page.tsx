import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Nav from "@/components/Nav";
import { createGroup, joinGroup } from "./actions";

type GroupMemberDisplay = {
  user_id: string;
  display_name: string;
  avatar_color: string;
};

export default async function GroupsPage(props: PageProps<"/groups">) {
  const { error: paramError } = await props.searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: groups } = await supabase
    .from("groups")
    .select("id, name, invite_code, created_by, created_at")
    .order("created_at", { ascending: true });

  const groupList = groups ?? [];
  const groupIds = groupList.map((g) => g.id);

  const membersByGroup: Record<string, GroupMemberDisplay[]> = {};

  if (groupIds.length > 0) {
    const { data: members } = await supabase
      .from("group_members")
      .select("group_id, user_id")
      .in("group_id", groupIds);

    const memberRows = members ?? [];
    const userIds = [...new Set(memberRows.map((m) => m.user_id))];

    const { data: profiles } = userIds.length
      ? await supabase
          .from("profiles")
          .select("id, display_name, avatar_color")
          .in("id", userIds)
      : { data: [] };

    const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));

    for (const member of memberRows) {
      const profile = profileById.get(member.user_id);
      const list = membersByGroup[member.group_id] ?? [];
      list.push({
        user_id: member.user_id,
        display_name: profile?.display_name ?? "Unknown",
        avatar_color: profile?.avatar_color ?? "#C0356E",
      });
      membersByGroup[member.group_id] = list;
    }
  }

  return (
    <div className="flex flex-1 flex-col items-center px-4 py-10">
      <div className="w-full max-w-2xl">
        <Nav email={user.email ?? ""} />

        <div className="mb-8 grid gap-6 sm:grid-cols-2">
          <form action={createGroup} className="flex flex-col gap-2">
            <label className="text-sm font-medium text-zinc-700">
              Create a group
            </label>
            <input
              name="name"
              required
              placeholder="The Mommas"
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500"
            />
            <button
              type="submit"
              className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white"
            >
              Create
            </button>
          </form>

          <form action={joinGroup} className="flex flex-col gap-2">
            <label className="text-sm font-medium text-zinc-700">
              Join a group
            </label>
            <input
              name="code"
              required
              placeholder="Invite code"
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500"
            />
            <button
              type="submit"
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-900"
            >
              Join
            </button>
          </form>
        </div>

        {paramError && (
          <p className="mb-6 text-sm text-red-600">{paramError}</p>
        )}

        <div className="flex flex-col gap-6">
          {groupList.length === 0 && (
            <p className="text-sm text-zinc-500">
              You&apos;re not in any groups yet.
            </p>
          )}
          {groupList.map((group) => (
            <div key={group.id} className="rounded-md border border-zinc-200 p-4">
              <div className="mb-2 flex items-baseline justify-between gap-2">
                <h2 className="text-lg font-semibold">{group.name}</h2>
                <span className="font-mono text-xs text-zinc-500">
                  invite code: {group.invite_code}
                </span>
              </div>
              <ul className="flex flex-col gap-1">
                {(membersByGroup[group.id] ?? []).map((member) => (
                  <li
                    key={member.user_id}
                    className="flex items-center gap-2 text-sm text-zinc-700"
                  >
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: member.avatar_color }}
                    />
                    {member.display_name}
                    {member.user_id === user.id && (
                      <span className="text-zinc-400">(you)</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
