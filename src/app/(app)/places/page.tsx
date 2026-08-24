import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Nav from "@/components/Nav";
import PlaceCard from "@/components/PlaceCard";
import type { Place, PlaceTip } from "@/types";

export default async function PlacesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: places } = await supabase
    .from("places")
    .select("*")
    .eq("active", true)
    .order("name", { ascending: true });
  const placeList = (places ?? []) as Place[];

  // Places has no group switcher of its own; tips default to the user's
  // first group, same fallback /calendar uses before a group is chosen.
  const { data: groups } = await supabase
    .from("groups")
    .select("id, name")
    .order("created_at", { ascending: true });
  const activeGroupId = groups?.[0]?.id ?? null;
  const activeGroupName = groups?.[0]?.name ?? null;

  const placeIds = placeList.map((p) => p.id);
  const { data: tips } =
    activeGroupId && placeIds.length
      ? await supabase
          .from("place_tips")
          .select("*")
          .eq("group_id", activeGroupId)
          .in("place_id", placeIds)
      : { data: [] };
  const tipRows = (tips ?? []) as PlaceTip[];

  const userIds = [...new Set(tipRows.map((t) => t.user_id))];
  const { data: profiles } = userIds.length
    ? await supabase.from("profiles").select("id, display_name").in("id", userIds)
    : { data: [] };
  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.display_name]));

  const tipsByPlace: Record<string, (PlaceTip & { display_name: string })[]> = {};
  for (const t of tipRows) {
    if (!t.place_id) continue;
    const list = tipsByPlace[t.place_id] ?? [];
    list.push({ ...t, display_name: nameById.get(t.user_id) ?? "Someone" });
    tipsByPlace[t.place_id] = list;
  }

  return (
    <div className="flex flex-1 flex-col items-center px-4 py-10">
      <div className="w-full max-w-2xl">
        <Nav email={user.email ?? ""} />

        <h1 className="font-display mb-6 text-2xl font-bold text-zinc-900">Explore</h1>

        <div className="flex flex-col gap-4">
          {placeList.length === 0 && (
            <p className="rounded-xl border border-dashed border-zinc-200 px-4 py-5 text-sm text-zinc-500">
              No curated places yet in your market — check back soon, or propose one from a group meetup.
            </p>
          )}
          {placeList.map((place) => (
            <PlaceCard
              key={place.id}
              place={place}
              groupId={activeGroupId}
              groupName={activeGroupName}
              currentUserId={user.id}
              tips={tipsByPlace[place.id] ?? []}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
