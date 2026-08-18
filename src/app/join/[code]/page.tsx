import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function JoinPage(props: PageProps<"/join/[code]">) {
  const { code } = await props.params;
  const normalizedCode = code.trim().toLowerCase();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/join/${normalizedCode}`)}`);
  }

  const { data: groupId, error } = await supabase.rpc("join_group_by_code", {
    code: normalizedCode,
  });

  if (error) {
    redirect(`/groups?error=${encodeURIComponent(error.message)}`);
  }

  redirect(`/calendar?group=${groupId}&joined=1`);
}
