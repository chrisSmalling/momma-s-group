import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { createClient } from "@/lib/supabase/server";

// Wraps every signed-in page and enforces first-run activation before the
// personalized app experience. The onboarding route intentionally lives
// outside this group so it can render without the signed-in tab bar.
export default async function AppLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarding_completed_at")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.onboarding_completed_at) redirect("/onboarding");

  return <div className="has-tabbar flex min-h-full flex-1 flex-col">{children}</div>;
}
