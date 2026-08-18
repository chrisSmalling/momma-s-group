// Mirrors db/schema.sql. Keep in sync with the tables defined there.

export interface Profile {
  id: string;
  display_name: string;
  avatar_color: string;
  created_at: string;
  nap_start: string | null;
  nap_end: string | null;
  child_age_months: number | null;
  home_lat: number | null;
  home_lng: number | null;
}

// A geographic market — e.g. Wesley Chapel + a 45-minute drive radius.
// events/places/recurring_programs.metro_area references markets.id.
export interface Market {
  id: string;
  name: string;
  center_lat: number;
  center_lng: number;
  radius_minutes: number;
  timezone: string;
  active: boolean;
  created_at: string;
}

export interface Group {
  id: string;
  name: string;
  invite_code: string;
  created_by: string;
  created_at: string;
}

export interface GroupMember {
  group_id: string;
  user_id: string;
  joined_at: string;
  // Allergies/medical notes, e.g. "peanut allergy, we bring our own snacks".
  // Optional, editable by the member, visible to their group.
  things_to_know: string | null;
}

// e.g. { mon: "10:00-21:00", tue: "10:00-21:00", ... } — keys are lowercase
// three-letter weekday abbreviations; a day absent from the object means
// closed. May be null when hours aren't known/curated yet.
export type PlaceHours = Partial<
  Record<"mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun", string>
>;

// The six venue-practicality flags shown as icons on place/event cards.
// Each is a nullable boolean: null/false both mean "don't show the icon" —
// there's no "no" icon, only affirmative highlights.
export interface VenuePracticalities {
  is_enclosed: boolean | null;
  has_changing_table: boolean | null;
  nursing_friendly: boolean | null;
  stroller_accessible: boolean | null;
  food_onsite: boolean | null;
  quiet_or_sensory_friendly: boolean | null;
}

export interface Place extends VenuePracticalities {
  id: string;
  name: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  metro_area: string;
  hours: PlaceHours | null;
  description: string | null;
  toddler_notes: string | null;
  price_note: string | null;
  age_min_months: number | null;
  age_max_months: number | null;
  website: string | null;
  booking_url: string | null;
  phone: string | null;
  source_url: string | null;
  last_verified_at: string | null;
  active: boolean;
  created_at: string;
  is_outdoor: boolean;
  food_allowed: boolean | null;
  restrooms: boolean | null;
  parking_notes: string | null;
  what_to_bring: string[];
  typical_crowd_note: string | null;
  best_time_note: string | null;
}

export interface RecurringProgram {
  id: string;
  place_id: string | null;
  venue_name: string | null;
  address: string | null;
  metro_area: string;
  title: string;
  description: string | null;
  rrule: string;
  start_time: string;
  duration_minutes: number;
  age_min_months: number | null;
  age_max_months: number | null;
  age_label: string | null;
  cost: string | null;
  registration_required: boolean;
  registration_url: string | null;
  season_start: string | null;
  season_end: string | null;
  source: string;
  source_url: string | null;
  last_verified_at: string | null;
  active: boolean;
  created_at: string;
}

export type EventStatus = "published" | "cancelled";

export interface Event {
  id: string;
  title: string;
  description: string | null;
  venue_name: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  starts_at: string;
  ends_at: string | null;
  age_tags: string[];
  cost: string | null;
  source: string;
  source_url: string | null;
  added_by: string | null;
  created_at: string;
  place_id: string | null;
  program_id: string | null;
  metro_area: string;
  external_id: string | null;
  status: EventStatus;
  registration_required: boolean;
  registration_url: string | null;
  age_min_months: number | null;
  age_max_months: number | null;
  // Set only on user-proposed meetups; null for curated/materialized events.
  proposed_by_group: string | null;
  last_verified_at: string | null;
  is_outdoor: boolean;
  what_to_bring: string[];
}

export type RsvpStatus = "going" | "maybe" | "not_going" | "out_sick";

export interface Rsvp {
  event_id: string;
  user_id: string;
  status: RsvpStatus;
  note: string | null;
  created_at: string;
  // Defaults on insert only — no trigger keeps this current on update.
  updated_at: string;
}

// A window of time a user has marked as free, scoped to a group.
export interface Availability {
  id: string;
  user_id: string;
  group_id: string;
  starts_at: string;
  ends_at: string;
  note: string | null;
  created_at: string;
}

export type TipCategory =
  | "general"
  | "parking"
  | "timing"
  | "facilities"
  | "cost"
  | "accessibility";

export interface PlaceTip {
  id: string;
  place_id: string | null;
  event_id: string | null;
  group_id: string;
  user_id: string;
  body: string;
  category: TipCategory;
  helpful_count: number;
  created_at: string;
}

export interface EventComment {
  id: string;
  event_id: string;
  group_id: string;
  user_id: string;
  body: string;
  promoted_tip_id: string | null;
  edited_at: string | null;
  created_at: string;
}

export interface OutingFeedback {
  event_id: string;
  user_id: string;
  would_repeat: boolean;
  note: string | null;
  created_at: string;
}

// Activity/source foundation (v6) — external activity aggregation
// infrastructure. RLS blocks the anon key entirely on both tables (no
// policies at all), so nothing in this app queries them today; these
// types exist for the future ingestion pipeline (a service-role context),
// not for use in any client/server component.
export type SourceType = "communico" | "libcal" | "rss" | "ical" | "manual" | "other";

export interface ActivitySource {
  id: string;
  name: string;
  source_type: SourceType;
  base_url: string | null;
  metro_area: string;
  active: boolean;
  fetch_frequency_minutes: number | null;
  last_fetch_at: string | null;
  last_fetch_status: "success" | "partial" | "error" | null;
  last_fetch_error: string | null;
  last_success_at: string | null;
  created_at: string;
}

export type VerificationStatus = "needs_review" | "verified" | "stale" | "cancelled";

export interface ActivitySourceRecord {
  id: string;
  source_id: string;
  external_id: string;
  external_url: string | null;
  // Raw fetched payload for debugging — shape varies per source_type,
  // deliberately untyped beyond "some JSON object."
  raw_payload: Record<string, unknown> | null;
  dedup_key: string;
  resolved_event_id: string | null;
  resolved_place_id: string | null;
  resolved_program_id: string | null;
  first_seen_at: string;
  last_seen_at: string;
  verification_status: VerificationStatus;
  created_at: string;
}

// From the my_cancelled_upcoming view. IMPORTANT: this view is not
// self-scoping — see the note in db/schema.sql. Always filter to the
// current user (`.eq("user_id", user.id)`) when querying it.
export interface CancelledUpcoming {
  event_id: string;
  title: string;
  starts_at: string;
  venue_name: string | null;
  user_id: string;
}
