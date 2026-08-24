"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { monthParam } from "@/lib/date";

export async function proposeMeetup(formData: FormData) {
  const placeId = String(formData.get("place_id") ?? "");
  const groupId = String(formData.get("group_id") ?? "");
  const startsAtRaw = String(formData.get("starts_at") ?? "");

  if (!placeId || !groupId || !startsAtRaw) {
    redirect(
      `/places/${placeId}/propose?error=${encodeURIComponent("Pick a group and a time")}`,
    );
  }

  const startsAt = new Date(startsAtRaw);
  if (Number.isNaN(startsAt.getTime())) {
    redirect(
      `/places/${placeId}/propose?error=${encodeURIComponent("Invalid date/time")}`,
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const { data: place } = await supabase
    .from("places")
    .select("name, address")
    .eq("id", placeId)
    .maybeSingle();

  if (!place) {
    redirect(`/places?error=${encodeURIComponent("Place not found")}`);
  }

  const { data: event, error } = await supabase
    .from("events")
    .insert({
      title: place.name,
      venue_name: place.name,
      address: place.address,
      place_id: placeId,
      proposed_by_group: groupId,
      added_by: user.id,
      starts_at: startsAt.toISOString(),
    })
    .select("id")
    .single();

  if (error || !event) {
    redirect(
      `/places/${placeId}/propose?error=${encodeURIComponent(error?.message ?? "Could not propose meetup")}`,
    );
  }

  revalidatePath("/calendar");
  redirect(`/calendar?month=${monthParam(startsAt)}#event-${event.id}`);
}

export async function addTip(formData: FormData) {
  const placeId = String(formData.get("place_id") ?? "") || null;
  const eventId = String(formData.get("event_id") ?? "") || null;
  const groupId = String(formData.get("group_id") ?? "");
  const category = String(formData.get("category") ?? "general");
  const body = String(formData.get("body") ?? "").trim();
  const redirectBack = eventId ? "/calendar" : "/places";

  if (!groupId || !body) {
    redirect(
      `${redirectBack}?error=${encodeURIComponent("A group and a tip are required")}`,
    );
  }
  if (body.length > 500) {
    redirect(
      `${redirectBack}?error=${encodeURIComponent("Tip is too long (500 characters max)")}`,
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const { error } = await supabase.from("place_tips").insert({
    place_id: placeId,
    event_id: eventId,
    group_id: groupId,
    user_id: user.id,
    body,
    category,
  });

  if (error) {
    redirect(`${redirectBack}?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/calendar");
  revalidatePath("/places");
}
