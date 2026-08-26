-- Keep production and repository schema permissions synchronized.
grant select on table public.event_freshness_state to authenticated;
