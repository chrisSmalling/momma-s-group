import type { createClient } from "@/lib/supabase/server";
import type { FeedEvent } from "@/types";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

const FREE_COST_VALUES = new Set(["free", "no cost", "$0", "0", "free admission"]);

// feed_events excludes anything that hasn't cleared verification (see its
// own WHERE clause) — which includes every user-proposed meetup, since a
// proposal is a real `events` row with no crawl/classification behind it.
// Falling back to the base table lets a proposal resolve for anyone the
// events RLS policy actually authorizes (a member of proposed_by_group, or
// anyone for a curated event) instead of always 404ing. The computed
// fields below (title/venue fallback chain, is_free, time_unknown) mirror
// feed_events' own derivations exactly rather than inventing new ones —
// nothing here is fabricated; a fact this row doesn't carry stays null/empty.
export async function resolveEvent(supabase: SupabaseClient, id: string): Promise<FeedEvent | null> {
  const { data: viewRow } = await supabase.from("feed_events").select("*").eq("id", id).maybeSingle();
  if (viewRow) return viewRow as FeedEvent;

  const { data: raw } = await supabase.from("events").select("*").eq("id", id).maybeSingle();
  if (!raw) return null;

  const cost = raw.cost as string | null;
  return {
    ...raw,
    title: (raw.display_title as string | null)?.trim() || raw.title,
    venue: (raw.venue_display as string | null)?.trim() || (raw.organizer as string | null)?.trim() || raw.venue_name || null,
    lat: raw.lat ?? raw.location_latitude,
    lng: raw.lng ?? raw.location_longitude,
    time_unknown: raw.time_precision === "date_only",
    is_free: cost ? FREE_COST_VALUES.has(cost.trim().toLowerCase()) : false,
    what_to_bring: raw.what_to_bring ?? [],
    age_tags: raw.age_tags ?? [],
  } as FeedEvent;
}
