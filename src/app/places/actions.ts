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
