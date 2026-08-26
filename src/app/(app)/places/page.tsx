import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Nav from "@/components/Nav";
import Poppy from "@/components/poppy/Poppy";
import WeatherContextCard from "@/components/WeatherContextCard";
import { getWeatherContext } from "@/lib/weather-context";

// The recommendation candidate pool is retrieved server-side inside
// /api/poppy/recommend, so this page no longer pulls the whole places/events
// dataset into the browser. It only needs light context to render Poppy's
// entry point plus the weather banner.
export default async function PlacesPage(props: PageProps<"/places">) {
  const searchParams = await props.searchParams;
  const ask = typeof searchParams.ask === "string" ? searchParams.ask : null;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("child_name, home_lat, home_lng")
    .eq("id", user.id)
    .maybeSingle();

  const childName = profile?.child_name?.trim() ? profile.child_name.trim() : null;
  const hasHome = profile?.home_lat != null && profile?.home_lng != null;

  let weather = null;
  if (profile?.home_lat != null && profile?.home_lng != null) {
    try { weather = await getWeatherContext(profile.home_lat, profile.home_lng); } catch { weather = null; }
  }

  return (
    <div className="flex flex-1 flex-col items-center px-4 py-10">
      <div className="w-full max-w-2xl">
        <Nav email={user.email ?? ""} />
        <div className="flex flex-col gap-5">
          <WeatherContextCard weather={weather} />
          <Poppy childName={childName} hasHome={hasHome} initialMessage={ask} />
          {!hasHome && (
            <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Add your home address in <a href="/settings" className="underline">Settings</a> so Poppy can sort ideas by how close they are.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
