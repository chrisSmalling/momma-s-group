"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { RsvpStatus } from "@/types";

// Persistence layer for RsvpButtons' optimistic UI: the caller already knows
// the intended end state (including null to clear), so this just writes it —
// no server-side toggle detection needed.
export async function rsvp(
  eventId: string,
  status: RsvpStatus | null,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const { error } = status
    ? await supabase
        .from("rsvps")
        .upsert({ event_id: eventId, user_id: user.id, status })
    : await supabase
        .from("rsvps")
        .delete()
        .eq("event_id", eventId)
        .eq("user_id", user.id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/calendar");
  return {};
}
