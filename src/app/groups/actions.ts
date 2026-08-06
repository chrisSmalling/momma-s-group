"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function createGroup(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) {
    redirect("/groups?error=Group%20name%20is%20required");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const { data: group, error } = await supabase
    .from("groups")
    .insert({ name, created_by: user.id })
    .select("id")
    .single();

  if (error || !group) {
    redirect(`/groups?error=${encodeURIComponent(error?.message ?? "Could not create group")}`);
  }

  // The creator isn't added to group_members automatically — do it here so
  // they show up in their own roster and share_group_with picks them up.
  const { error: memberError } = await supabase
    .from("group_members")
    .insert({ group_id: group.id, user_id: user.id });

  if (memberError) {
    redirect(`/groups?error=${encodeURIComponent(memberError.message)}`);
  }

  revalidatePath("/groups");
}

export async function joinGroup(formData: FormData) {
  const code = String(formData.get("code") ?? "").trim().toLowerCase();
  if (!code) {
    redirect("/groups?error=Invite%20code%20is%20required");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const { error } = await supabase.rpc("join_group_by_code", { code });

  if (error) {
    redirect(`/groups?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/groups");
}
