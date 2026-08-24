import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import Nav from "@/components/Nav";
import { updateNapSettings, updateHomeLocation } from "./actions";

export default async function SettingsPage(props: PageProps<"/settings">) {
  const searchParams = await props.searchParams;
  const paramError = typeof searchParams.error === "string" ? searchParams.error : undefined;
  const saved = searchParams.saved === "1";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("nap_start, nap_end, child_age_months, home_address")
    .eq("id", user.id)
    .maybeSingle();

  const trimTime = (t: string | null | undefined) => (t ? t.slice(0, 5) : "");

  return (
    <div className="flex flex-1 flex-col items-center px-4 py-10">
      <div className="w-full max-w-md">
        <Nav email={user.email ?? ""} />

        <h1 className="font-display mb-1 text-2xl font-bold text-zinc-900">Nap window</h1>
        <p className="mb-6 text-sm text-zinc-500">
          Events that overlap this window show dimmed on your calendar (never hidden) so you can plan around nap time.
        </p>

        {saved && <p className="mb-4 text-sm text-emerald-700">Saved.</p>}
        {paramError && <p className="mb-4 text-sm text-red-600">{paramError}</p>}

        <form action={updateNapSettings} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-sm text-zinc-600">
              Nap starts
              <input type="time" name="nap_start" defaultValue={trimTime(profile?.nap_start)} className="rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500" />
            </label>
            <label className="flex flex-col gap-1 text-sm text-zinc-600">
              Nap ends
              <input type="time" name="nap_end" defaultValue={trimTime(profile?.nap_end)} className="rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500" />
            </label>
          </div>

          <label className="flex flex-col gap-1 text-sm text-zinc-600">
            Child&apos;s age (months)
            <input type="number" name="child_age_months" min={0} defaultValue={profile?.child_age_months ?? ""} className="rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500" />
          </label>

          <button type="submit" className="self-start rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white">Save</button>
        </form>

        <h1 className="font-display mb-1 mt-10 text-xl font-bold text-zinc-900">Home address</h1>
        <p className="mb-4 text-sm text-zinc-500">
          Enter the address you want Momma&apos;s Meetup to use as your home base. We&apos;ll use the address to calculate real driving distance and time to events and places. You never need to enter latitude or longitude.
        </p>

        <form action={updateHomeLocation} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm text-zinc-600">
            Home address
            <input
              type="text"
              name="home_address"
              defaultValue={profile?.home_address ?? ""}
              autoComplete="street-address"
              placeholder="123 Main St, Wesley Chapel, FL 33543"
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500"
            />
          </label>
          <p className="text-xs text-zinc-400">Your address is used only to personalize distance and travel-time calculations.</p>

          <button type="submit" className="self-start rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white">Save home address</button>
        </form>

        <h1 className="font-display mb-1 mt-10 text-xl font-bold text-zinc-900">About</h1>
        <nav aria-label="Legal" className="flex flex-col gap-2 text-sm">
          <Link href="/privacy" className="text-zinc-600 underline underline-offset-2 hover:text-zinc-900">Privacy policy</Link>
          <Link href="/terms" className="text-zinc-600 underline underline-offset-2 hover:text-zinc-900">Terms of service</Link>
          <Link href="/account/delete" className="text-zinc-600 underline underline-offset-2 hover:text-zinc-900">Delete account</Link>
        </nav>
      </div>
    </div>
  );
}
