"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

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
  if (!user) {
    redirect("/login");
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      nap_start: napStart || null,
      nap_end: napEnd || null,
      child_age_months: childAgeMonths,
    })
    .eq("id", user.id);

  if (error) {
    redirect(`/settings?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/settings?saved=1");
}

export async function updateHomeLocation(formData: FormData) {
  const latRaw = String(formData.get("home_lat") ?? "").trim();
  const lngRaw = String(formData.get("home_lng") ?? "").trim();

  const homeLat = latRaw ? Number(latRaw) : null;
  const homeLng = lngRaw ? Number(lngRaw) : null;

  if (latRaw && (Number.isNaN(homeLat) || homeLat! < -90 || homeLat! > 90)) {
    redirect("/settings?error=Latitude%20must%20be%20between%20-90%20and%2090");
  }
  if (lngRaw && (Number.isNaN(homeLng) || homeLng! < -180 || homeLng! > 180)) {
    redirect("/settings?error=Longitude%20must%20be%20between%20-180%20and%20180");
  }
  if ((homeLat === null) !== (homeLng === null)) {
    redirect("/settings?error=Enter%20both%20latitude%20and%20longitude%2C%20or%20neither");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const { error } = await supabase
    .from("profiles")
    .update({ home_lat: homeLat, home_lng: homeLng })
    .eq("id", user.id);

  if (error) {
    redirect(`/settings?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/settings?saved=1");
}
