"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { geocodeAddress } from "@/lib/geocoding";

const ALLOWED_INTERESTS = new Set([
  "animals", "arts_and_crafts", "water", "sports", "trains", "flying",
  "playgrounds", "books", "music", "adventure", "science", "food",
]);

const ALLOWED_CATEGORIES = new Set([
  "active_play", "animals", "arts_learning", "playground", "storytime", "water_play",
]);

export async function completeOnboarding(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const childAgeRaw = String(formData.get("child_age_months") ?? "").trim();
  const childAgeMonths = Number(childAgeRaw);
  if (!childAgeRaw || !Number.isFinite(childAgeMonths) || childAgeMonths < 0 || childAgeMonths > 144) {
    redirect("/onboarding?error=Tell%20Poppy%20your%20child%27s%20age%20so%20she%20can%20make%20better%20picks.");
  }

  const childName = String(formData.get("child_name") ?? "").trim().slice(0, 60);
  const displayNameInput = String(formData.get("display_name") ?? "").trim().slice(0, 80);
  const interests = formData.getAll("child_interests").map(String).filter((value) => ALLOWED_INTERESTS.has(value));
  const categories = formData.getAll("preferred_categories").map(String).filter((value) => ALLOWED_CATEGORIES.has(value));
  const indoorRaw = String(formData.get("indoor_preference") ?? "either");
  const indoorPreference = ["indoor", "outdoor", "either"].includes(indoorRaw) ? indoorRaw : "either";
  const budgetNote = String(formData.get("family_budget_note") ?? "").trim().slice(0, 200);

  const maxDistanceRaw = String(formData.get("max_distance_miles") ?? "20").trim();
  const maxDistanceParsed = Number(maxDistanceRaw);
  const maxDistanceMiles = Number.isFinite(maxDistanceParsed) && maxDistanceParsed >= 1 && maxDistanceParsed <= 200
    ? Math.round(maxDistanceParsed)
    : 20;

  const { data: existingProfile } = await supabase
    .from("profiles")
    .select("display_name, avatar_color")
    .eq("id", user.id)
    .maybeSingle();

  const displayName = displayNameInput || existingProfile?.display_name || user.user_metadata?.full_name || user.email?.split("@")[0] || "Momma";

  const street = String(formData.get("home_street") ?? "").trim();
  const city = String(formData.get("home_city") ?? "").trim();
  const state = String(formData.get("home_state") ?? "").trim().toUpperCase();
  const zip = String(formData.get("home_zip") ?? "").trim();
  const hasAnyAddress = Boolean(street || city || state || zip);

  if (hasAnyAddress && (!street || !city || !state || !zip)) {
    redirect("/onboarding?error=If%20you%20add%20a%20home%20location%2C%20please%20complete%20the%20street%2C%20city%2C%20state%2C%20and%20ZIP.");
  }
  if (hasAnyAddress && (!/^[A-Z]{2}$/.test(state) || !/^\d{5}(?:-\d{4})?$/.test(zip))) {
    redirect("/onboarding?error=Please%20enter%20a%20valid%20state%20and%20ZIP%20code.");
  }

  let homeAddress: string | null = null;
  let homeLat: number | null = null;
  let homeLng: number | null = null;
  if (hasAnyAddress) {
    homeAddress = `${street}, ${city}, ${state} ${zip}`;
    const geocoded = await geocodeAddress({ street, city, state, zip });
    homeLat = geocoded?.lat ?? null;
    homeLng = geocoded?.lng ?? null;
  }

  const { error } = await supabase.from("profiles").upsert({
    id: user.id,
    display_name: displayName,
    avatar_color: existingProfile?.avatar_color ?? "#C0356E",
    child_name: childName || null,
    child_age_months: Math.round(childAgeMonths),
    child_interests: interests,
    child_activity_preferences: categories,
    preferred_categories: categories,
    family_budget_note: budgetNote || null,
    indoor_preference: indoorPreference,
    max_distance_miles: maxDistanceMiles,
    home_address: homeAddress,
    home_street: hasAnyAddress ? street : null,
    home_city: hasAnyAddress ? city : null,
    home_state: hasAnyAddress ? state : null,
    home_zip: hasAnyAddress ? zip : null,
    home_lat: homeLat,
    home_lng: homeLng,
    onboarding_completed_at: new Date().toISOString(),
  });

  if (error) redirect(`/onboarding?error=${encodeURIComponent(error.message)}`);

  revalidatePath("/today");
  revalidatePath("/places");
  revalidatePath("/settings");
  redirect("/today");
}
