-- ============================================================
-- Security hardening: materialize_programs() (v7)
--
-- materialize_programs() is SECURITY DEFINER with no internal auth.uid()
-- check (unlike join_group_by_code/who_is_free/promote_comment_to_tip,
-- which all gate meaningfully on auth.uid()/is_member()). Postgres grants
-- EXECUTE on a new function to PUBLIC by default unless explicitly
-- revoked, and nothing in its original definition revoked it — so it was
-- callable by anon/authenticated through the public Data API
-- (PostgREST's /rpc/materialize_programs endpoint), not just the
-- protected cron route added in v6/PR #15. Abuse vector: no data leak
-- (it returns only an occurrence count), but anyone with the public anon
-- key could trigger repeated writes across recurring_programs -> events.
--
-- Fix is a privilege change only — the function's body/logic is untouched.
-- ============================================================

revoke execute on function materialize_programs(integer) from public;
revoke execute on function materialize_programs(integer) from anon;
revoke execute on function materialize_programs(integer) from authenticated;
grant  execute on function materialize_programs(integer) to service_role;

-- NOTE (not fixed here, flagging only — same class of issue, different
-- function, out of this PR's scope): cancel_event(uuid, text) has the
-- identical shape. Its own comment says "Not exposed in the app UI — a
-- curator/admin tool," which is exactly the kind of function that
-- shouldn't be PUBLIC-executable either, and it returns RSVP'd users'
-- display_name/user_id via its return table. Worth a follow-up PR with
-- the same revoke/grant treatment.
