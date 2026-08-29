import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Nav from "@/components/Nav";
import Poppy from "@/components/poppy/Poppy";
import WeatherContextCard from "@/components/WeatherContextCard";
import { getWeatherContext } from "@/lib/weather-context";

export default async function PlacesPage(props: PageProps<"/places">) {
  const searchParams = await props.searchParams;
  const ask = typeof searchParams.ask === "string" ? searchParams.ask : null;
  const groupId = typeof searchParams.group === "string" ? searchParams.group : null;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("child_name, home_address, home_lat, home_lng")
    .eq("id", user.id)
    .maybeSingle();

  const childName = profile?.child_name?.trim() ? profile.child_name.trim() : null;
  const hasSavedHome = Boolean(profile?.home_address?.trim());
  const hasUsableHome = profile?.home_lat != null && profile?.home_lng != null;

  let weather = null;
  if (hasUsableHome) {
    try { weather = await getWeatherContext(profile.home_lat, profile.home_lng); } catch { weather = null; }
  }

  return (
    <div className="flex flex-1 flex-col items-center px-4 py-10">
      <div className="w-full max-w-2xl">
        <Nav email={user.email ?? ""} />
        <div className="flex flex-col gap-5">
          <WeatherContextCard weather={weather} />
          <Poppy childName={childName} hasHome={hasSavedHome} initialMessage={ask} groupId={groupId} />
          <Link href="/places/browse" className="self-start text-sm font-semibold text-rose-700 hover:underline">
            Browse all places by category &rarr;
          </Link>
          {!hasSavedHome && (
            <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Add your home address in <a href="/settings" className="underline">Settings</a> so Poppy can sort ideas by how close they are.
            </p>
          )}
          {hasSavedHome && !hasUsableHome && (
            <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Your home address is saved. Location verification is still pending, so Poppy will use it for personalization as soon as routing coordinates are available.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
