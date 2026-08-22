"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function deleteAccount() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login?error=auth_required");

  const { error } = await supabase.rpc("delete_my_account");
  if (error) throw new Error("We could not delete your account. Please try again.");

  await supabase.auth.signOut();
  redirect("/login?deleted=1");
}
