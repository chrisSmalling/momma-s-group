"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function markFree(formData: FormData) {
  const groupId = String(formData.get("group_id") ?? "");
  const startsAtRaw = String(formData.get("starts_at") ?? "");
  const endsAtRaw = String(formData.get("ends_at") ?? "");
  const note = String(formData.get("note") ?? "").trim();

  if (!groupId || !startsAtRaw || !endsAtRaw) {
    redirect(
      `/free?error=${encodeURIComponent("Pick a group and a start/end time")}`,
    );
  }

  const startsAt = new Date(startsAtRaw);
  const endsAt = new Date(endsAtRaw);
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
    redirect(`/free?error=${encodeURIComponent("Invalid date/time")}`);
  }
  if (endsAt <= startsAt) {
    redirect(`/free?error=${encodeURIComponent("End time must be after start time")}`);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const { error } = await supabase.from("availability").insert({
    user_id: user.id,
    group_id: groupId,
    starts_at: startsAt.toISOString(),
    ends_at: endsAt.toISOString(),
    note: note || null,
  });

  if (error) {
    redirect(`/free?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/free");
}

export async function removeFreeWindow(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) {
    redirect("/free");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const { error } = await supabase
    .from("availability")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    redirect(`/free?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/free");
}
