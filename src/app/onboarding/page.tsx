import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SiteFooter from "@/components/SiteFooter";
import ActivationFlow from "./ActivationFlow";

function str(value: string | string[] | undefined): string | undefined { return typeof value === "string" ? value : undefined; }
function list(value: string | string[] | undefined): string[] { if (value == null) return []; return Array.isArray(value) ? value : [value]; }

export default async function OnboardingPage(props: PageProps<"/onboarding">) {
  const searchParams = await props.searchParams;
  const error = str(searchParams.error);
  // Carried forward from a failed submission (see carryForward() in
  // actions.ts) so a validation error doesn't reset the whole flow.
  const initial = {
    step: str(searchParams.step) === "1" || str(searchParams.step) === "2" || str(searchParams.step) === "3" ? (Number(searchParams.step) as 1 | 2 | 3) : (1 as const),
    age: str(searchParams.child_age_months) ?? "",
    childName: str(searchParams.child_name) ?? "",
    interests: list(searchParams.child_interests),
    categories: list(searchParams.preferred_categories),
    indoorPreference: str(searchParams.indoor_preference) ?? "either",
    budget: str(searchParams.family_budget_note) ?? "",
    maxDistance: str(searchParams.max_distance_miles) ?? "20",
    homeStreet: str(searchParams.home_street) ?? "",
    homeCity: str(searchParams.home_city) ?? "",
    homeState: str(searchParams.home_state) ?? "",
    homeZip: str(searchParams.home_zip) ?? "",
  };

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
          <ActivationFlow error={error} initial={initial} />
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
