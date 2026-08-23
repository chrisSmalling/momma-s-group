"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function createGroup(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) redirect("/groups?error=Group%20name%20is%20required");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: group, error } = await supabase.from("groups").insert({ name, created_by: user.id }).select("id").single();
  if (error || !group) redirect(`/groups?error=${encodeURIComponent(error?.message ?? "Could not create group")}`);
  const { error: memberError } = await supabase.from("group_members").insert({ group_id: group.id, user_id: user.id });
  if (memberError) redirect(`/groups?error=${encodeURIComponent(memberError.message)}`);
  revalidatePath("/groups");
}

export async function updateThingsToKnow(formData: FormData) {
  const groupId = String(formData.get("group_id") ?? "");
  const thingsToKnow = String(formData.get("things_to_know") ?? "").trim();
  if (!groupId) redirect("/groups?error=Missing%20group");
  if (thingsToKnow.length > 300) redirect(`/groups?error=${encodeURIComponent("Things to know is too long (300 characters max)")}`);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { error } = await supabase.from("group_members").update({ things_to_know: thingsToKnow || null }).eq("group_id", groupId).eq("user_id", user.id);
  if (error) redirect(`/groups?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/groups");
}

export async function joinGroup(formData: FormData) {
  const code = String(formData.get("code") ?? "").trim().toLowerCase();
  if (!code) redirect("/groups?error=Invite%20code%20is%20required");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { error } = await supabase.rpc("join_group_by_code", { code });
  if (error) redirect(`/groups?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/groups");
}

export async function askGroupAboutEvent(groupId: string, eventId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Please sign in first." };
  const { error } = await supabase.rpc("ask_group_about_event", { p_group_id: groupId, p_event_id: eventId, p_question: "Anyone want to do this?" });
  if (error) return { error: error.message };
  revalidatePath("/today");
  return { ok: true };
}
