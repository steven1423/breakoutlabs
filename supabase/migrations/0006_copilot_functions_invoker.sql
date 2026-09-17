-- M3: Postgres forbids SET ROLE inside a security-definer function, so the two copilot functions
-- run as the caller (service_role), which is granted membership in `copilot` and switches to it.
-- Only service_role may execute them; the switch drops every privilege except the copilot views.

grant copilot to service_role;

create or replace function public.copilot_run_readonly_query(query text)
returns jsonb
language plpgsql
security invoker
set search_path = copilot, pg_temp
as $$
declare
  result jsonb;
begin
  perform set_config('role', 'copilot', true);
  perform set_config('transaction_read_only', 'on', true);
  perform set_config('statement_timeout', '5000', true);
  execute format(
    'select coalesce(jsonb_agg(row_to_json(t)), ''[]''::jsonb) from (select * from (%s) q limit 200) t',
    query
  ) into result;
  return result;
end;
$$;

create or replace function public.copilot_explain_query(query text)
returns jsonb
language plpgsql
security invoker
set search_path = copilot, pg_temp
as $$
declare
  result jsonb;
begin
  perform set_config('role', 'copilot', true);
  perform set_config('transaction_read_only', 'on', true);
  perform set_config('statement_timeout', '5000', true);
  execute format('explain (format json) %s', query) into result;
  return result;
end;
$$;

revoke execute on function public.copilot_run_readonly_query(text) from public, anon, authenticated;
revoke execute on function public.copilot_explain_query(text) from public, anon, authenticated;
grant execute on function public.copilot_run_readonly_query(text) to service_role;
grant execute on function public.copilot_explain_query(text) to service_role;
