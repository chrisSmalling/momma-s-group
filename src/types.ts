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
}

export type RsvpStatus = "going" | "maybe";

export interface Rsvp {
  event_id: string;
  user_id: string;
  status: RsvpStatus;
  created_at: string;
}
