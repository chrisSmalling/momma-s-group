REVOKE EXECUTE ON FUNCTION public.apply_local_event_quality_rules() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_local_event_quality_rules() TO postgres, service_role;
ALTER FUNCTION public.apply_local_event_quality_rules() SET search_path = public, pg_temp;

REVOKE EXECUTE ON FUNCTION public.apply_organizer_feedback() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_organizer_feedback() TO postgres, service_role;
ALTER FUNCTION public.apply_organizer_feedback() SET search_path = public, pg_temp;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO postgres, service_role;
ALTER FUNCTION public.handle_new_user() SET search_path = public, pg_temp;

REVOKE EXECUTE ON FUNCTION public.promote_comment_to_tip(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.promote_comment_to_tip(uuid, text) TO postgres, service_role;
ALTER FUNCTION public.promote_comment_to_tip(uuid, text) SET search_path = public, pg_temp;
