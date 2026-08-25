-- pg_trgm was installed directly into the public schema (no tracked
-- migration created it, and nothing in the app depends on it — confirmed
-- via pg_depend: zero non-internal dependents, and the one GIN index in
-- public, places_active_category_tags_gin, uses the default array_ops,
-- not a trigram operator class). Supabase's own linter flags extensions
-- left in public; move it to a dedicated schema instead.
create schema if not exists extensions;
alter extension pg_trgm set schema extensions;
