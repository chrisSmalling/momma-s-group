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
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase
    .from("profiles")
    .update({ nap_start: napStart || null, nap_end: napEnd || null, child_age_months: childAgeMonths })
    .eq("id", user.id);

  if (error) redirect(`/settings?error=${encodeURIComponent(error.message)}`);
  redirect("/settings?saved=1");
}

export async function updateHomeLocation(formData: FormData) {
  const address = String(formData.get("home_address") ?? "").trim();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  if (!address) {
    const { error } = await supabase
      .from("profiles")
      .update({ home_address: null, home_lat: null, home_lng: null })
      .eq("id", user.id);
    if (error) redirect(`/settings?error=${encodeURIComponent(error.message)}`);
    redirect("/settings?address_saved=cleared");
  }

  // The member-entered address is the source of truth. Save it even when the
  // geocoder is unavailable; coordinates are only a routing cache and can be
  // populated later without asking the member to enter coordinates.
  const geocoded = await geocodeAddress(address);
  const { error } = await supabase
    .from("profiles")
    .update({
      home_address: address,
      home_lat: geocoded?.lat ?? null,
      home_lng: geocoded?.lng ?? null,
    })
    .eq("id", user.id);

  if (error) redirect(`/settings?error=${encodeURIComponent(error.message)}`);
  redirect(`/settings?address_saved=${geocoded ? "verified" : "saved"}`);
}
