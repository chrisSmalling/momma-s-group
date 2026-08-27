-- The Poppy route records an audit row as the authenticated user.
-- The function remains SECURITY DEFINER and enforces auth.uid() = p_user_id.
grant execute on function public.record_recommendation_execution(uuid,text,text,jsonb,integer,uuid[],text) to authenticated;
