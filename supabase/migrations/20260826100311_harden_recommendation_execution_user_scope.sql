-- Harden recommendation execution audit writes against user-id impersonation.
-- The function is SECURITY DEFINER so it must enforce the caller identity itself.

create or replace function public.record_recommendation_execution(
  p_user_id uuid,
  p_raw_prompt text,
  p_intent text,
  p_constraints jsonb,
  p_candidate_count integer,
  p_selected_ids uuid[],
  p_model text default null
)
returns uuid
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  rid uuid;
begin
  if auth.uid() is null or auth.uid() <> p_user_id then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  insert into public.recommendation_requests(
    user_id,
    raw_prompt,
    intent,
    constraints,
    candidate_count,
    selected_ids,
    model
  )
  values (
    p_user_id,
    left(p_raw_prompt, 2000),
    left(p_intent, 100),
    coalesce(p_constraints, '{}'::jsonb),
    greatest(coalesce(p_candidate_count, 0), 0),
    p_selected_ids,
    p_model
  )
  returning id into rid;

  return rid;
end;
$$;