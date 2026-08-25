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
  place_type: string | null;
  // Real, already-populated ingestion taxonomy (playground, outdoor, indoor,
  // animals, storytime, arts_learning, water_play, active_play) — use this
  // for mood/intent matching instead of guessing from free-text description.
  category_tags: string[];
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
  // Plain column (not generated — confirmed live), default false. Always
  // true for non-communico events; for communico events, set by ingestion
  // via the is_kid_relevant_event() SQL function (single source of truth
  // — ingest.ts calls it rather than reimplementing the keyword logic in
  // TypeScript, so the two can't drift the way they briefly did here).
  is_kid_relevant: boolean;
}

// public.feed_events — the view /today and /calendar actually query.
// Applies status='published' AND is_kid_relevant AND NOT is_suppressed
// AND duplicate_of IS NULL server-side, so page code never hand-filters
// events. Display fields are pre-resolved here (title/venue fall back
// through display_title/venue_display to the raw columns via a
// canonicalize_venue() trigger) — render these, not events.title/
// events.venue_name, directly.
export interface FeedEvent {
  id: string;
  title: string;
  description: string | null;
  venue: string | null;
  room_name: string | null;
  organizer: string | null;
  address: string | null;
  // lat/lng coalesce events.lat/lng with location_latitude/longitude;
  // the raw (non-coalesced) pair is also exposed below since some
  // consumers (e.g. /today's weather lookup) want the same fallback
  // chain explicitly.
  lat: number | null;
  lng: number | null;
  location_latitude: number | null;
  location_longitude: number | null;
  starts_at: string;
  ends_at: string | null;
  time_precision: string;
  // true when time_precision = 'date_only' — render "All day"/"Check
  // times", never a clock time, when this is true.
  time_unknown: boolean;
  cost: string | null;
  is_free: boolean;
  age_tags: string[];
  age_min_months: number | null;
  age_max_months: number | null;
  // From the out-of-band content-classification pipeline (see db/schema.sql
  // v10 note) — a looser triage signal, NOT a substitute for
  // is_kid_relevant (confirmed against real data: 'review'-status rows
  // include 186 genuinely kid-relevant events). Useful as a ranking input,
  // not a filter.
  age_band: string | null;
  is_outdoor: boolean;
  what_to_bring: string[];
  registration_required: boolean;
  registration_url: string | null;
  source: string;
  source_id: string | null;
  source_url: string | null;
  content_status: string | null;
  geography_tier: string | null;
  experience_type: string | null;
  weather_fit: string | null;
  place_id: string | null;
  program_id: string | null;
  proposed_by_group: string | null;
  metro_area: string;
  status: EventStatus;
  last_verified_at: string | null;
  added_by: string | null;
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
  // Orthogonal to source_type: which export a multi-format vendor's
  // adapter should parse (v8). Null when not applicable/not yet configured.
  feed_format: "rss" | "ical" | null;
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
