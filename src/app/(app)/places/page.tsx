import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Nav from "@/components/Nav";
import Explorer from "@/components/Explorer";
import ExplorerAssistantV3 from "@/components/ExplorerAssistantV3";
import WeatherContextCard from "@/components/WeatherContextCard";
import { getWeatherContext } from "@/lib/weather-context";
import type { Event, Place, PlaceTip } from "@/types";

export default async function PlacesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const now = new Date();
  const todayEnd = new Date(now); todayEnd.setHours(23, 59, 59, 999);
  const [{ data: places }, { data: groups }, { data: profile }, { data: events }] = await Promise.all([
    supabase.from("places").select("*").eq("active", true).order("name", { ascending: true }),
    supabase.from("groups").select("id, name").order("created_at", { ascending: true }),
    supabase.from("profiles").select("child_age_months, home_lat, home_lng").eq("id", user.id).maybeSingle(),
    supabase.from("events").select("*").eq("status", "published").eq("is_kid_relevant", true).gte("starts_at", now.toISOString()).lte("starts_at", todayEnd.toISOString()).order("starts_at", { ascending: true }).limit(30),
  ]);
  const placeList = (places ?? []) as Place[];
  const eventList = (events ?? []) as Event[];
  const activeGroupId = groups?.[0]?.id ?? null;
  const activeGroupName = groups?.[0]?.name ?? null;
  const placeIds = placeList.map((p) => p.id);
  const { data: tips } = activeGroupId && placeIds.length ? await supabase.from("place_tips").select("*").eq("group_id", activeGroupId).in("place_id", placeIds) : { data: [] };
  const tipRows = (tips ?? []) as PlaceTip[];
  const userIds = [...new Set(tipRows.map((t) => t.user_id))];
  const { data: profiles } = userIds.length ? await supabase.from("profiles").select("id, display_name").in("id", userIds) : { data: [] };
  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.display_name]));
  const tipsByPlace: Record<string, (PlaceTip & { display_name: string })[]> = {};
  for (const tip of tipRows) { if (!tip.place_id) continue; const list = tipsByPlace[tip.place_id] ?? []; list.push({ ...tip, display_name: nameById.get(tip.user_id) ?? "Someone" }); tipsByPlace[tip.place_id] = list; }
  let weather = null;
  if (profile?.home_lat != null && profile?.home_lng != null) { try { weather = await getWeatherContext(profile.home_lat, profile.home_lng); } catch { weather = null; } }
  return <div className="flex flex-1 flex-col items-center px-4 py-10"><div className="w-full max-w-2xl"><Nav email={user.email ?? ""} /><div className="flex flex-col gap-5"><WeatherContextCard weather={weather} /><ExplorerAssistantV3 places={placeList} events={eventList} childAgeMonths={profile?.child_age_months ?? null} homeLat={profile?.home_lat ?? null} homeLng={profile?.home_lng ?? null} weather={weather} /><Explorer places={placeList} groupId={activeGroupId} groupName={activeGroupName} currentUserId={user.id} tipsByPlace={tipsByPlace} childAgeMonths={profile?.child_age_months ?? null} homeLat={profile?.home_lat ?? null} homeLng={profile?.home_lng ?? null} /></div></div></div>;
}
