"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function addEvent(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  const venueName = String(formData.get("venue_name") ?? "").trim();
  const startsAtRaw = String(formData.get("starts_at") ?? "");
  const endsAtRaw = String(formData.get("ends_at") ?? "");
  const ageTagsRaw = String(formData.get("age_tags") ?? "");
  const cost = String(formData.get("cost") ?? "").trim();

  if (!title || !startsAtRaw) {
    redirect("/calendar?error=Title%20and%20start%20time%20are%20required");
  }

  const startsAt = new Date(startsAtRaw);
  if (Number.isNaN(startsAt.getTime())) {
    redirect("/calendar?error=Invalid%20start%20time");
  }

  const endsAt = endsAtRaw ? new Date(endsAtRaw) : null;
  const ageTags = ageTagsRaw
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const { error } = await supabase.from("events").insert({
    title,
    venue_name: venueName || null,
    starts_at: startsAt.toISOString(),
    ends_at: endsAt && !Number.isNaN(endsAt.getTime()) ? endsAt.toISOString() : null,
    age_tags: ageTags,
    cost: cost || null,
    added_by: user.id,
  });

  if (error) {
    redirect(`/calendar?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/calendar");
}

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
