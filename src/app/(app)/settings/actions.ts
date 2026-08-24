"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { geocodeAddress } from "@/lib/geocoding";

export async function updateNapSettings(formData: FormData) {
  const napStart = String(formData.get("nap_start") ?? "").trim();
  const napEnd = String(formData.get("nap_end") ?? "").trim();
  const childAgeRaw = String(formData.get("child_age_months") ?? "").trim();

  const childAgeMonths = childAgeRaw ? Number(childAgeRaw) : null;
  if (childAgeMonths !== null && (Number.isNaN(childAgeMonths) || childAgeMonths < 0)) {
    redirect("/settings?error=Child%20age%20must%20be%20a%20positive%20number");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase
    .from("profiles")
    .update({
      nap_start: napStart || null,
      nap_end: napEnd || null,
      child_age_months: childAgeMonths,
    })
    .eq("id", user.id);

  if (error) redirect(`/settings?error=${encodeURIComponent(error.message)}`);
  redirect("/settings?saved=1");
}

export async function updateHomeLocation(formData: FormData) {
  const address = String(formData.get("home_address") ?? "").trim();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  if (!address) {
    const { error } = await supabase
      .from("profiles")
      .update({ home_address: null, home_lat: null, home_lng: null })
      .eq("id", user.id);
    if (error) redirect(`/settings?error=${encodeURIComponent(error.message)}`);
    redirect("/settings?saved=1");
  }

  const geocoded = await geocodeAddress(address);
  if (!geocoded) {
    redirect("/settings?error=We%20couldn%27t%20find%20that%20address.%20Check%20the%20street%20address%20and%20ZIP%20code%20and%20try%20again.");
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      home_address: address,
      // These coordinates are an internal geocoding cache derived from the
      // address. Members never enter or manage coordinates themselves.
      home_lat: geocoded.lat,
      home_lng: geocoded.lng,
    })
    .eq("id", user.id);

  if (error) redirect(`/settings?error=${encodeURIComponent(error.message)}`);
  redirect("/settings?saved=1");
}
