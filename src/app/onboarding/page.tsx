import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SiteFooter from "@/components/SiteFooter";
import ActivationFlow from "./ActivationFlow";

export default async function OnboardingPage(props: PageProps<"/onboarding">) {
  const searchParams = await props.searchParams;
  const error = typeof searchParams.error === "string" ? searchParams.error : undefined;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarding_completed_at")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.onboarding_completed_at) redirect("/today");

  return (
    <>
      <main className="flex flex-1 items-center justify-center bg-gradient-to-b from-rose-50 via-white to-white px-4 py-8 sm:py-12">
        <div className="w-full max-w-2xl">
          <div className="mb-6 text-center">
            <div className="text-2xl font-extrabold tracking-tight text-zinc-950">Momma&apos;s Meetup</div>
            <p className="mt-1 text-sm text-zinc-500">Let&apos;s get Poppy ready for your family.</p>
          </div>
          <ActivationFlow error={error} />
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
