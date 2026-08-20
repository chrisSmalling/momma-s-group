import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function InvitePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const inviteCode = decodeURIComponent(code).trim().toLowerCase();

  if (!inviteCode) {
    redirect("/login");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const next = `/invite/${encodeURIComponent(inviteCode)}`;

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(next)}`);
  }

  const { error } = await supabase.rpc("join_group_by_code", {
    code: inviteCode,
  });

  if (error) {
    redirect(`/groups?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/today");
}
