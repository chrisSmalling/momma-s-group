-- Backfill the structured home address fields (home_street, home_city, home_state,
-- home_zip) from the canonical home_address ("Street, City, ST ZIP").
--
-- Safe/conservative by design:
--   * Only fills rows whose structured fields are still empty (never overwrites).
--   * Only parses addresses that confidently match the canonical shape
--     (two-letter state + 5 or 5-4 ZIP); anything ambiguous is left NULL rather
--     than guessed. This mirrors the app's own save-time validation.
--   * home_address stays the canonical user-entered/display value (untouched).
--   * home_lat / home_lng (internal geocoding cache) are untouched.
update public.profiles p
set
  home_street = btrim((m.parts)[1]),
  home_city   = btrim((m.parts)[2]),
  home_state  = upper(btrim((m.parts)[3])),
  home_zip    = btrim((m.parts)[4])
from (
  select id,
    regexp_match(
      home_address,
      '^\s*(.+),\s*([^,]+),\s*([A-Za-z]{2})\.?\s+(\d{5}(?:-\d{4})?)\s*$'
    ) as parts
  from public.profiles
  where home_address is not null
    and home_street is null and home_city is null
    and home_state is null and home_zip is null
) m
where p.id = m.id
  and m.parts is not null;
