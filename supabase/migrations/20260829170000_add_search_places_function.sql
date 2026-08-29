-- Search places by activity — the shared backbone for "where can I take her
-- for gymnastics?" (Poppy) and the Places directory's search box + tag chips.
--
-- Verified live 2026-08-29: places have `place_type` (indoor/outdoor/
-- destination — not an activity category) and a 9-value controlled-vocabulary
-- `category_tags` (playground, outdoor, indoor, animals, storytime,
-- active_play, arts_learning, water_play, sensory_play). There is no
-- "gymnastics" tag or any specific-activity tag; "gymnastics" only turns up
-- via free text in name/description/toddler_notes (6 matches). So this
-- function does NOT filter on category_tags alone for the search term — it
-- also does a free-text ILIKE across name/description/toddler_notes AND
-- each category_tags element, matching either.
--
-- 102 active places today: a plain ILIKE scan is fine. When the table grows
-- enough for this to matter, add a pg_trgm GIN index (extensions.similarity,
-- same pattern as refresh_fuzzy_event_duplicate_clusters) or a tsvector
-- column — don't build it preemptively.
--
-- Deliberately NOT `security definer`: this runs as the calling
-- (authenticated) role so the existing "read places" RLS policy
-- (verified + geocoded + active-market only) applies exactly as it would to
-- a direct `select` — one source of truth for place eligibility, not a
-- second copy that can drift from it.
create or replace function public.search_places(
  p_term text default null,
  p_tags text[] default null,
  p_limit integer default 30
)
returns setof public.places
language sql
stable
as $$
  select p.*
  from public.places p
  where
    (
      p_term is null or btrim(p_term) = '' or
      p.name ilike '%' || p_term || '%' or
      p.description ilike '%' || p_term || '%' or
      p.toddler_notes ilike '%' || p_term || '%' or
      exists (
        select 1 from unnest(p.category_tags) tag
        where tag ilike '%' || p_term || '%'
      )
    )
    and (
      p_tags is null or array_length(p_tags, 1) is null or p.category_tags && p_tags
    )
  order by
    case
      when p_term is not null and p.name ilike p_term then 0
      when p_term is not null and p.name ilike p_term || '%' then 1
      else 2
    end,
    p.discovery_priority desc nulls last,
    p.name asc
  limit greatest(1, least(coalesce(p_limit, 30), 100));
$$;

grant execute on function public.search_places(text, text[], integer) to authenticated;
revoke execute on function public.search_places(text, text[], integer) from anon;
