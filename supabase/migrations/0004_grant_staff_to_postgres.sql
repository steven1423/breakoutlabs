-- M1: the Supabase admin role is not a superuser, so it can only `set role staff` as a member.
-- This lets policies be exercised through the SQL endpoint (used by the M1 verification and later tests).
grant staff to postgres;
