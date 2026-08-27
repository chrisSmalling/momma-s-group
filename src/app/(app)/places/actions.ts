"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function proposeMeetup(formData: FormData) {
  const placeId = String(formData.get("place_id") ?? "");
  const groupId = String(formData.get("group_id") ?? "");
  const startsAtRaw = String(formData.get("starts_at") ?? "");

  if (!placeId || !groupId || !startsAtRaw) {
    redirect(`/places/${placeId}/propose?error=${encodeURIComponent("Pick a group and a time")}`);
  }

  const startsAt = new Date(startsAtRaw);
  if (Number.isNaN(startsAt.getTime())) {
    redirect(`/places/${placeId}/propose?error=${encodeURIComponent("Invalid date/time")}`);
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: eventId, error } = await supabase.rpc("propose_event_for_group", {
    p_place_id: placeId,
    p_group_id: groupId,
    p_starts_at: startsAt.toISOString(),
  });

  if (error || !eventId) {
    redirect(`/places/${placeId}/propose?error=${encodeURIComponent(error?.message ?? "Could not propose meetup")}`);
  }

  revalidatePath("/calendar");
  revalidatePath("/plans");
  revalidatePath(`/events/${eventId}`);
  redirect(`/proposal/success/${eventId}`);
}

export async function addTip(formData: FormData) {
  const placeId = String(formData.get("place_id") ?? "") || null;
  const eventId = String(formData.get("event_id") ?? "") || null;
  const groupId = String(formData.get("group_id") ?? "");
  const category = String(formData.get("category") ?? "general");
  const body = String(formData.get("body") ?? "").trim();
  const redirectBack = eventId ? "/calendar" : "/places";

  if (!groupId || !body) redirect(`${redirectBack}?error=${encodeURIComponent("A group and a tip are required")}`);
  if (body.length > 500) redirect(`${redirectBack}?error=${encodeURIComponent("Tip is too long (500 characters max)")}`);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase.from("place_tips").insert({
    place_id: placeId,
    event_id: eventId,
    group_id: groupId,
    user_id: user.id,
    body,
    category,
  });

  if (error) redirect(`${redirectBack}?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/calendar");
  revalidatePath("/places");
}
