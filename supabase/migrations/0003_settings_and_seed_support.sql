-- M1: default settings and the one function the seed script needs.

insert into settings (key, value) values
  ('min_cohort', '50'::jsonb),
  ('sla_hours', '{
    "ordered": 48, "backordered": 72, "shipped": 168, "delivered": 240, "registered": 240,
    "registration_mismatch": 24, "sample_received": 168, "resulted": 72, "results_locked": 24,
    "blueprint_ready": 72, "viewed": 336, "retest_due": 336
  }'::jsonb),
  ('claude_model', '"claude-sonnet-5"'::jsonb)
on conflict (key) do nothing;

-- Wipes every synthetic table so `pnpm seed` can be re-run and produce identical rows.
-- Settings are kept; the seed re-applies them explicitly. Callable only with the secret key.
create or replace function reset_synthetic_data()
returns void
language sql
security definer
set search_path = public
as $$
  truncate table
    attributions, campaigns, creator_cards, creators, allocator_runs,
    pending_actions, tickets, outcomes, checkins, interventions, blueprints,
    customer_segments, biomarker_results, panels, kit_events, kits, customers
  restart identity cascade;
$$;

revoke execute on function reset_synthetic_data() from public, anon, authenticated;
grant execute on function reset_synthetic_data() to service_role;
