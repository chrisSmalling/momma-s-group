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

// A validation failure redirects back to /onboarding, which is a real
// navigation that remounts ActivationFlow from scratch — so every value
// already entered (including earlier, already-valid steps) needs to ride
// along in the query string as defaults, or the whole flow resets to step 1
// over one bad ZIP code on step 3.
function carryForward(step: 1 | 2 | 3, formData: FormData, extra: Record<string, string>): string {
  const params = new URLSearchParams(extra);
  params.set("step", String(step));
  const fields = ["child_age_months", "child_name", "indoor_preference", "family_budget_note", "max_distance_miles", "home_street", "home_city", "home_state", "home_zip"];
  for (const field of fields) { const value = formData.get(field); if (typeof value === "string" && value) params.set(field, value); }
  for (const value of formData.getAll("child_interests")) if (typeof value === "string") params.append("child_interests", value);
  for (const value of formData.getAll("preferred_categories")) if (typeof value === "string") params.append("preferred_categories", value);
  return params.toString();
}

export async function completeOnboarding(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const childAgeRaw = String(formData.get("child_age_months") ?? "").trim();
  const childAgeMonths = Number(childAgeRaw);
  if (!childAgeRaw || !Number.isFinite(childAgeMonths) || childAgeMonths < 0 || childAgeMonths > 144) {
    redirect(`/onboarding?${carryForward(1, formData, { error: "Tell Poppy your child's age so she can make better picks." })}`);
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
    redirect(`/onboarding?${carryForward(3, formData, { error: "If you add a home location, please complete the street, city, state, and ZIP." })}`);
  }
  if (hasAnyAddress && (!/^[A-Z]{2}$/.test(state) || !/^\d{5}(?:-\d{4})?$/.test(zip))) {
    redirect(`/onboarding?${carryForward(3, formData, { error: "Please enter a valid state and ZIP code." })}`);
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

  if (error) redirect(`/onboarding?${carryForward(3, formData, { error: error.message })}`);

  revalidatePath("/today");
  revalidatePath("/places");
  revalidatePath("/settings");
  redirect("/today");
}
