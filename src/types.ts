// Mirrors db/schema.sql. Keep in sync with the tables defined there.

export interface Profile {
  id: string;
  display_name: string;
  avatar_color: string;
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
}

// e.g. { mon: "10:00-21:00", tue: "10:00-21:00", ... } — keys are lowercase
// three-letter weekday abbreviations; a day absent from the object means
// closed. May be null when hours aren't known/curated yet.
export type PlaceHours = Partial<
  Record<"mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun", string>
>;

export interface Place {
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
}

export type RsvpStatus = "going" | "maybe";

export interface Rsvp {
  event_id: string;
  user_id: string;
  status: RsvpStatus;
  created_at: string;
}
