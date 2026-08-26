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

// The interest tokens Poppy understands. Anything the form submits outside
// this allow-list is dropped (defense against tampered form posts).
const ALLOWED_INTERESTS = new Set([
  "animals", "arts_and_crafts", "water", "sports", "trains", "flying",
  "playgrounds", "books", "music", "adventure", "science", "food",
]);

export async function updatePoppyProfile(formData: FormData) {
  const childName = String(formData.get("child_name") ?? "").trim().slice(0, 60);
  const budgetNote = String(formData.get("family_budget_note") ?? "").trim().slice(0, 200);
  const indoorPrefRaw = String(formData.get("indoor_preference") ?? "either");
  const indoorPreference = ["indoor", "outdoor", "either"].includes(indoorPrefRaw) ? indoorPrefRaw : "either";
  const interests = formData.getAll("child_interests").map(String).filter((v) => ALLOWED_INTERESTS.has(v));

  const maxDistanceRaw = String(formData.get("max_distance_miles") ?? "").trim();
  let maxDistanceMiles: number | null = null;
  if (maxDistanceRaw) {
    const parsed = Number(maxDistanceRaw);
    if (Number.isNaN(parsed) || parsed <= 0 || parsed > 200) {
      redirect("/settings?error=Distance%20must%20be%20between%201%20and%20200%20miles");
    }
    maxDistanceMiles = Math.round(parsed);
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase
    .from("profiles")
    .update({
      child_name: childName || null,
      child_interests: interests,
      family_budget_note: budgetNote || null,
      indoor_preference: indoorPreference,
      max_distance_miles: maxDistanceMiles,
    })
    .eq("id", user.id);

  if (error) redirect(`/settings?error=${encodeURIComponent(error.message)}`);
  redirect("/settings?poppy_saved=1");
}

export async function updateHomeLocation(formData: FormData) {
  const street = String(formData.get("home_street") ?? "").trim();
  const city = String(formData.get("home_city") ?? "").trim();
  const state = String(formData.get("home_state") ?? "").trim().toUpperCase();
  const zip = String(formData.get("home_zip") ?? "").trim();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  if (!street && !city && !state && !zip) {
    const { error } = await supabase
      .from("profiles")
      .update({ home_address: null, home_street: null, home_city: null, home_state: null, home_zip: null, home_lat: null, home_lng: null })
      .eq("id", user.id);
    if (error) redirect(`/settings?error=${encodeURIComponent(error.message)}`);
    redirect("/settings?address_saved=cleared");
  }

  if (!street || !city || !state || !zip) {
    redirect("/settings?address_error=Please%20enter%20your%20street%2C%20city%2C%20state%2C%20and%20ZIP%20code");
  }
  if (!/^[A-Z]{2}$/.test(state)) redirect("/settings?address_error=Use%20a%20two-letter%20state%20code");
  if (!/^\d{5}(?:-\d{4})?$/.test(zip)) redirect("/settings?address_error=Enter%20a%20valid%20ZIP%20code");

  const address = `${street}, ${city}, ${state} ${zip}`;
  const geocoded = await geocodeAddress({ street, city, state, zip });
  const { error } = await supabase
    .from("profiles")
    .update({
      home_address: address,
      home_street: street,
      home_city: city,
      home_state: state,
      home_zip: zip,
      home_lat: geocoded?.lat ?? null,
      home_lng: geocoded?.lng ?? null,
    })
    .eq("id", user.id);

  if (error) redirect(`/settings?error=${encodeURIComponent(error.message)}`);
  redirect(`/settings?address_saved=${geocoded ? "verified" : "saved"}`);
}
