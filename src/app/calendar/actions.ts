"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function rsvp(formData: FormData) {
  const eventId = String(formData.get("eventId") ?? "");
  const status = String(formData.get("status") ?? "");

  if (!eventId || (status !== "going" && status !== "maybe")) {
    redirect("/calendar?error=Invalid%20RSVP");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const { data: existing } = await supabase
    .from("rsvps")
    .select("status")
    .eq("event_id", eventId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing?.status === status) {
    // Clicking the already-active status toggles the RSVP off.
    const { error } = await supabase
      .from("rsvps")
      .delete()
      .eq("event_id", eventId)
      .eq("user_id", user.id);
    if (error) {
      redirect(`/calendar?error=${encodeURIComponent(error.message)}`);
    }
  } else {
    const { error } = await supabase
      .from("rsvps")
      .upsert({ event_id: eventId, user_id: user.id, status });
    if (error) {
      redirect(`/calendar?error=${encodeURIComponent(error.message)}`);
    }
  }

  revalidatePath("/calendar");
}
