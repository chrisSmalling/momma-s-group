import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Nav from "@/components/Nav";
import ProposeMeetupForm from "@/components/ProposeMeetupForm";

export default async function ProposeMeetupPage(
  props: PageProps<"/places/[id]/propose">,
) {
  const { id } = await props.params;
  const searchParams = await props.searchParams;
  const paramError =
    typeof searchParams.error === "string" ? searchParams.error : undefined;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: place } = await supabase
    .from("places")
    .select("id, name")
    .eq("id", id)
    .maybeSingle();

  if (!place) {
    notFound();
  }

  const { data: groups } = await supabase
    .from("groups")
    .select("id, name")
    .order("created_at", { ascending: true });
  const groupList = groups ?? [];

  return (
    <div className="flex flex-1 flex-col items-center px-4 py-10">
      <div className="w-full max-w-md">
        <Nav email={user.email ?? ""} />

        <h1 className="text-xl font-bold text-zinc-900">Propose a meetup</h1>
        <p className="mb-6 text-sm text-zinc-500">at {place.name}</p>

        {paramError && (
          <p className="mb-4 text-sm text-red-600">{paramError}</p>
        )}

        {groupList.length === 0 ? (
          <p className="text-sm text-zinc-500">
            You need to be in a group to propose a meetup —{" "}
            <a href="/groups" className="underline">
              create or join one
            </a>
            .
          </p>
        ) : (
          <ProposeMeetupForm placeId={place.id} groups={groupList} />
        )}
      </div>
    </div>
  );
}
