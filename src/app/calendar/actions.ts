"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { EventComment, RsvpStatus, TipCategory } from "@/types";

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

export async function addComment(
  eventId: string,
  groupId: string,
  body: string,
): Promise<{ error?: string; comment?: EventComment }> {
  const trimmed = body.trim();
  if (!trimmed) {
    return { error: "Comment can't be empty" };
  }
  if (trimmed.length > 1000) {
    return { error: "Comment is too long (1000 characters max)" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const { data, error } = await supabase
    .from("event_comments")
    .insert({
      event_id: eventId,
      group_id: groupId,
      user_id: user.id,
      body: trimmed,
    })
    .select("*")
    .single();

  if (error || !data) {
    return { error: error?.message ?? "Could not post comment" };
  }

  revalidatePath("/calendar");
  return { comment: data as EventComment };
}

// Any member of the comment's group can promote it, not just its author —
// promote_comment_to_tip enforces that via is_member(group_id) itself.
export async function promoteToTip(
  commentId: string,
  category: TipCategory,
): Promise<{ error?: string; tipId?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const { data, error } = await supabase.rpc("promote_comment_to_tip", {
    comment_id: commentId,
    tip_category: category,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/calendar");
  revalidatePath("/places");
  return { tipId: data as string };
}
