import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Nav from "@/components/Nav";
import PlaceCard from "@/components/PlaceCard";
import type { Place } from "@/types";

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

  return (
    <div className="flex flex-1 flex-col items-center px-4 py-10">
      <div className="w-full max-w-2xl">
        <Nav email={user.email ?? ""} />

        <h1 className="mb-6 text-xl font-bold text-zinc-900">Places</h1>

        <div className="flex flex-col gap-4">
          {placeList.length === 0 && (
            <p className="text-sm text-zinc-500">No places yet.</p>
          )}
          {placeList.map((place) => (
            <PlaceCard key={place.id} place={place} />
          ))}
        </div>
      </div>
    </div>
  );
}
