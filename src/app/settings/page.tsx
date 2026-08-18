import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Nav from "@/components/Nav";
import { updateNapSettings } from "./actions";

export default async function SettingsPage(props: PageProps<"/settings">) {
  const searchParams = await props.searchParams;
  const paramError =
    typeof searchParams.error === "string" ? searchParams.error : undefined;
  const saved = searchParams.saved === "1";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("nap_start, nap_end, child_age_months")
    .eq("id", user.id)
    .maybeSingle();

  // time columns come back as "HH:MM:SS" — <input type="time"> wants "HH:MM"
  const trimTime = (t: string | null | undefined) => (t ? t.slice(0, 5) : "");

  return (
    <div className="flex flex-1 flex-col items-center px-4 py-10">
      <div className="w-full max-w-md">
        <Nav email={user.email ?? ""} />

        <h1 className="mb-1 text-xl font-bold text-zinc-900">Nap window</h1>
        <p className="mb-6 text-sm text-zinc-500">
          Events that overlap this window show dimmed on your calendar (never
          hidden) so you can plan around nap time.
        </p>

        {saved && (
          <p className="mb-4 text-sm text-emerald-700">Saved.</p>
        )}
        {paramError && (
          <p className="mb-4 text-sm text-red-600">{paramError}</p>
        )}

        <form action={updateNapSettings} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-sm text-zinc-600">
              Nap starts
              <input
                type="time"
                name="nap_start"
                defaultValue={trimTime(profile?.nap_start)}
                className="rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-zinc-600">
              Nap ends
              <input
                type="time"
                name="nap_end"
                defaultValue={trimTime(profile?.nap_end)}
                className="rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500"
              />
            </label>
          </div>

          <label className="flex flex-col gap-1 text-sm text-zinc-600">
            Child&apos;s age (months)
            <input
              type="number"
              name="child_age_months"
              min={0}
              defaultValue={profile?.child_age_months ?? ""}
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500"
            />
          </label>

          <button
            type="submit"
            className="self-start rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white"
          >
            Save
          </button>
        </form>
      </div>
    </div>
  );
}
