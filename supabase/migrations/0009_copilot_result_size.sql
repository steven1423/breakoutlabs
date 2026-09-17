-- M8: the 200-row cap bounded rows, not bytes. `select jsonb_agg(row_to_json(t)) from biomarker_results t`
-- is one row carrying the whole table: a live call returned 842 KB, which the transparency panel
-- reported as "1 row" and the loop pasted into the model's context. Rows were never the right unit.
-- Forward-only replacement: the row cap stays and a byte ceiling is added underneath it.

create or replace function public.copilot_run_readonly_query(query text)
returns jsonb
language plpgsql
security invoker
set search_path = copilot, pg_temp
as $$
declare
  result jsonb;
  size int;
  ceiling constant int := 131072;   -- 128 KiB; 200 rows of any ordinary width fit well inside it
begin
  perform set_config('role', 'copilot', true);
  perform set_config('transaction_read_only', 'on', true);
  perform set_config('statement_timeout', '5000', true);
  execute format(
    'select coalesce(jsonb_agg(row_to_json(t)), ''[]''::jsonb) from (select * from (%s) q limit 200) t',
    query
  ) into result;
  size := octet_length(result::text);
  if size > ceiling then
    raise exception 'Result is % bytes, over the % byte limit. Aggregate in SQL (count, avg, group by) or select fewer columns instead of returning whole rows.', size, ceiling;
  end if;
  return result;
end;
$$;

revoke execute on function public.copilot_run_readonly_query(text) from public, anon, authenticated;
grant execute on function public.copilot_run_readonly_query(text) to service_role;
