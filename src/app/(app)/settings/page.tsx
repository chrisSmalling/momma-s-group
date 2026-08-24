import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import Nav from "@/components/Nav";
import { updateNapSettings, updateHomeLocation } from "./actions";

function parseLegacyAddress(value: string | null | undefined) {
  if (!value) return { street: "", city: "", state: "", zip: "" };
  const parts = value.split(",").map((part) => part.trim()).filter(Boolean);
  if (parts.length < 3) return { street: value, city: "", state: "", zip: "" };
  const street = parts.slice(0, -2).join(", ");
  const city = parts[parts.length - 2] ?? "";
  const last = parts[parts.length - 1] ?? "";
  const match = last.match(/^(.+?)\s+(\d{5}(?:-\d{4})?)$/);
  return { street, city, state: match?.[1]?.trim().toUpperCase() ?? last, zip: match?.[2] ?? "" };
}

export default async function SettingsPage(props: PageProps<"/settings">) {
  const searchParams = await props.searchParams;
  const paramError = typeof searchParams.error === "string" ? searchParams.error : undefined;
  const addressError = typeof searchParams.address_error === "string" ? searchParams.address_error : undefined;
  const saved = searchParams.saved === "1";
  const addressSaved = typeof searchParams.address_saved === "string" ? searchParams.address_saved : undefined;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("nap_start, nap_end, child_age_months, home_address, home_street, home_city, home_state, home_zip, home_lat, home_lng")
    .eq("id", user.id)
    .maybeSingle();

  const legacy = parseLegacyAddress(profile?.home_address);
  const street = profile?.home_street ?? legacy.street;
  const city = profile?.home_city ?? legacy.city;
  const state = profile?.home_state ?? legacy.state;
  const zip = profile?.home_zip ?? legacy.zip;
  const trimTime = (t: string | null | undefined) => (t ? t.slice(0, 5) : "");
  const addressVerified = Boolean(profile?.home_address && profile?.home_lat !== null && profile?.home_lng !== null);

  return (
    <div className="flex flex-1 flex-col items-center px-4 py-10">
      <div className="w-full max-w-md">
        <Nav email={user.email ?? ""} />

        <h1 className="font-display mb-1 text-2xl font-bold text-zinc-900">Nap window</h1>
        <p className="mb-6 text-sm text-zinc-500">Events that overlap this window show dimmed on your calendar (never hidden) so you can plan around nap time.</p>

        {saved && <p className="mb-4 text-sm text-emerald-700">Saved.</p>}
        {paramError && <p className="mb-4 text-sm text-red-600">{paramError}</p>}

        <form action={updateNapSettings} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-sm text-zinc-600">Nap starts<input type="time" name="nap_start" defaultValue={trimTime(profile?.nap_start)} className="rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500" /></label>
            <label className="flex flex-col gap-1 text-sm text-zinc-600">Nap ends<input type="time" name="nap_end" defaultValue={trimTime(profile?.nap_end)} className="rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500" /></label>
          </div>
          <label className="flex flex-col gap-1 text-sm text-zinc-600">Child&apos;s age (months)<input type="number" name="child_age_months" min={0} defaultValue={profile?.child_age_months ?? ""} className="rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500" /></label>
          <button type="submit" className="self-start rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white">Save</button>
        </form>

        <h1 className="font-display mb-1 mt-10 text-xl font-bold text-zinc-900">Home address</h1>
        <p className="mb-4 text-sm text-zinc-500">Use your complete home address. We&apos;ll use it to calculate real driving distance and time to events and places. You never need to enter latitude or longitude.</p>

        {addressSaved === "verified" && <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800"><strong>✓ Home address saved and verified.</strong><span className="block text-xs text-emerald-700">Momma&apos;s Meetup can use it for personalized travel times.</span></div>}
        {addressSaved === "saved" && <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800"><strong>✓ Home address saved.</strong><span className="block text-xs text-amber-700">We&apos;ll verify the location when the geocoding service is available.</span></div>}
        {addressSaved === "cleared" && <p className="mb-4 text-sm text-zinc-600">Home address removed.</p>}
        {addressError && <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{addressError}</p>}

        <form action={updateHomeLocation} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm text-zinc-600">Street address<input type="text" name="home_street" defaultValue={street} autoComplete="street-address" placeholder="123 Main St" required className="rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500" /></label>
          <div className="grid grid-cols-[1fr_5rem] gap-3">
            <label className="flex flex-col gap-1 text-sm text-zinc-600">City<input type="text" name="home_city" defaultValue={city} autoComplete="address-level2" placeholder="Wesley Chapel" required className="rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500" /></label>
            <label className="flex flex-col gap-1 text-sm text-zinc-600">State<input type="text" name="home_state" defaultValue={state} autoComplete="address-level1" placeholder="FL" maxLength={2} required className="rounded-md border border-zinc-300 px-3 py-2 text-sm uppercase text-zinc-900 outline-none focus:border-zinc-500" /></label>
          </div>
          <label className="flex flex-col gap-1 text-sm text-zinc-600">ZIP code<input type="text" name="home_zip" defaultValue={zip} inputMode="numeric" autoComplete="postal-code" placeholder="33543" pattern="[0-9]{5}(-[0-9]{4})?" required className="rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500" /></label>

          <div className="rounded-xl bg-zinc-50 px-3 py-2.5">
            <p className="text-xs font-semibold text-zinc-700">Your complete address</p>
            <p className="mt-1 text-sm text-zinc-600">{street || "Street"}{city ? `, ${city}` : ""}{state ? `, ${state}` : ""}{zip ? ` ${zip}` : ""}</p>
            <p className="mt-1 text-[11px] text-zinc-400">The address you enter is the source of truth. Coordinates are only an internal routing cache.</p>
          </div>

          {profile?.home_address && <p className="text-xs font-medium text-zinc-500">{addressVerified ? "✓ Location verified for routing" : "○ Address saved; location verification pending"}</p>}
          <button type="submit" className="self-start rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white">Save home address</button>
        </form>

        <h1 className="font-display mb-1 mt-10 text-xl font-bold text-zinc-900">About</h1>
        <nav aria-label="Legal" className="flex flex-col gap-2 text-sm"><Link href="/privacy" className="text-zinc-600 underline underline-offset-2 hover:text-zinc-900">Privacy policy</Link><Link href="/terms" className="text-zinc-600 underline underline-offset-2 hover:text-zinc-900">Terms of service</Link><Link href="/account/delete" className="text-zinc-600 underline underline-offset-2 hover:text-zinc-900">Delete account</Link></nav>
      </div>
    </div>
  );
}
