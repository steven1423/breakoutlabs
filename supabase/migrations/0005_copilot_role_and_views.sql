-- M3: the copilot reads through a separate role that can only SELECT masked views in schema copilot.
-- The two public functions run the model's SQL under that role over HTTPS (docs/DECISIONS.md, M3).

create schema if not exists copilot;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'copilot') then
    create role copilot nologin;
  end if;
end $$;

grant copilot to postgres;
grant usage on schema copilot to copilot;
-- Applies to direct connections with this role; the RPC path sets it per call as well.
alter role copilot set statement_timeout = '5s';

-- Masked views. They run as their owner, so the copilot role needs no grants on base tables.
create or replace view copilot.customers as
  select id, first_name, email_masked, region_state, age_band, sex, acquisition_channel, creator_code,
         plan, membership, membership_started_at, membership_months, consent_research, created_at
  from public.customers;

create or replace view copilot.kits as
  select id, customer_id, kit_code, sequence_no, state, state_entered_at, created_at from public.kits;

create or replace view copilot.kit_events as
  select id, kit_id, from_state, to_state, at, actor, note from public.kit_events;

create or replace view copilot.tickets as
  select id, customer_id, kit_id, channel, subject, left(body, 500) as body, status, opened_at, likely_cause
  from public.tickets;

create or replace view copilot.panels as
  select id, kit_id, customer_id, sequence_no, collected_at, resulted_at from public.panels;

create or replace view copilot.biomarker_results as
  select id, panel_id, marker, value, unit, ref_low, ref_high, flag from public.biomarker_results;

create or replace view copilot.customer_segments as
  select customer_id, primary_segment, confidence, computed_at from public.customer_segments;

create or replace view copilot.outcomes as
  select customer_id, baseline_panel_id, retest_panel_id, markers_improved, severity_delta, improved, computed_at
  from public.outcomes;

create or replace view copilot.checkins as
  select id, customer_id, at, severity_self_reported from public.checkins;

create or replace view copilot.pending_actions as
  select id, type, customer_id, status, proposed_by, created_at, decided_at from public.pending_actions;

create or replace view copilot.settings as
  select key, value from public.settings;

grant select on all tables in schema copilot to copilot;
alter default privileges in schema copilot grant select on tables to copilot;

-- Runs one read-only SELECT as the copilot role, capped at 200 rows, and returns the rows as JSON.
create or replace function public.copilot_run_readonly_query(query text)
returns jsonb
language plpgsql
security definer
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

-- Plans the query as the copilot role without running it. Fails on bad SQL or missing privileges.
create or replace function public.copilot_explain_query(query text)
returns jsonb
language plpgsql
security definer
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
