-- M1: enums and tables from CLAUDE.md §5, verbatim.

create type plan_type as enum ('standalone','membership_first','study');
create type membership_status as enum ('none','active','cancelled');
create type sex_type as enum ('female','male','other');
create type age_band as enum ('16-19','20-24','25-34','35-44','45+');
create type channel as enum ('instagram','youtube','tiktok','search','referral','direct');
create type segment as enum ('androgen','insulin','cortisol','nutrient','inflammation','mixed');
create type marker as enum ('testosterone','dhea_s','shbg','cortisol','insulin','vitamin_d','zinc','hs_crp');
create type flag as enum ('low','optimal','high');
create type kit_state as enum (
  'ordered','backordered','shipped','delivered','registered','registration_mismatch',
  'sample_received','resulted','results_locked','blueprint_ready','viewed',
  'checkin_active','retest_due','retest_ordered','cancelled','refunded');
create type actor as enum ('system','staff','customer','lab');
create type ticket_status as enum ('open','pending_customer','resolved');
create type likely_cause as enum (
  'unlinked_kit','portal_lockout','backorder','shipping_delay','billing',
  'registration_mismatch','refund_request','clinical_question','other');
create type platform as enum ('youtube','instagram','tiktok');
create type data_status as enum ('live','seeded');
create type intervention_type as enum ('supplement','skincare','rx','lifestyle');
create type action_type as enum ('nudge_sms','nudge_email','ticket_note');
create type action_status as enum ('proposed','confirmed','rejected');

create table customers (
  id uuid primary key default gen_random_uuid(),
  email_masked text not null,
  first_name text not null,
  region_state text not null,
  age_band age_band not null,
  sex sex_type not null,
  acquisition_channel channel not null,
  creator_code text,
  plan plan_type not null default 'standalone',
  membership membership_status not null default 'none',
  membership_started_at timestamptz,
  membership_months int not null default 0,
  consent_research boolean not null default false,
  consent_marketing boolean not null default false,
  created_at timestamptz not null default now()
);

create table kits (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id),
  kit_code text unique not null,
  sequence_no int not null default 1,
  state kit_state not null default 'ordered',
  state_entered_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table kit_events (
  id uuid primary key default gen_random_uuid(),
  kit_id uuid not null references kits(id),
  from_state kit_state,
  to_state kit_state not null,
  at timestamptz not null default now(),
  actor actor not null,
  note text
);

create table panels (
  id uuid primary key default gen_random_uuid(),
  kit_id uuid not null references kits(id),
  customer_id uuid not null references customers(id),
  sequence_no int not null,
  collected_at timestamptz not null,
  resulted_at timestamptz not null
);

create table biomarker_results (
  id uuid primary key default gen_random_uuid(),
  panel_id uuid not null references panels(id),
  marker marker not null,
  value numeric not null,
  unit text not null,
  ref_low numeric not null,
  ref_high numeric not null,
  flag flag not null
);

create table customer_segments (
  customer_id uuid primary key references customers(id),
  primary_segment segment not null,
  confidence numeric not null,
  computed_at timestamptz not null default now()
);

create table blueprints (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id),
  panel_id uuid not null references panels(id),
  drafted_by actor not null,
  status text not null check (status in ('draft','approved')),
  content jsonb not null,
  approved_by text,
  approved_at timestamptz,
  created_at timestamptz not null default now()
);

create table interventions (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id),
  type intervention_type not null,
  sku text not null,
  started_at timestamptz not null,
  ended_at timestamptz
);

create table checkins (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id),
  at timestamptz not null,
  photo_quality_score numeric,
  severity_self_reported int check (severity_self_reported between 0 and 10)
);

create table outcomes (
  customer_id uuid primary key references customers(id),
  baseline_panel_id uuid not null references panels(id),
  retest_panel_id uuid not null references panels(id),
  markers_improved int not null,
  severity_delta int not null,
  improved boolean not null,
  computed_at timestamptz not null default now()
);

create table tickets (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id),
  kit_id uuid references kits(id),
  channel text not null,
  subject text not null,
  body text not null,
  status ticket_status not null default 'open',
  opened_at timestamptz not null default now(),
  likely_cause likely_cause,
  ai_summary jsonb
);

create table pending_actions (
  id uuid primary key default gen_random_uuid(),
  type action_type not null,
  customer_id uuid not null references customers(id),
  payload jsonb not null,
  proposed_by text not null,
  status action_status not null default 'proposed',
  created_at timestamptz not null default now(),
  decided_at timestamptz
);

create table creators (
  id uuid primary key default gen_random_uuid(),
  platform platform not null,
  handle text not null,
  display_name text,
  url text not null,
  followers int,
  engagement_rate numeric,
  avg_views int,
  bio text,
  recent_titles jsonb,
  external_id text,
  source text not null,
  data_status data_status not null,
  enriched_at timestamptz,
  unique (platform, handle)
);

create table creator_cards (
  creator_id uuid primary key references creators(id),
  summary text not null,
  fit_score int not null check (fit_score between 0 and 100),
  fit_reasoning text not null,
  predicted_segment segment not null,
  approach_angle text not null,
  price_band_low int not null,
  price_band_high int not null,
  outreach_draft text not null,
  model text not null,
  generated_at timestamptz not null default now()
);

create table campaigns (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references creators(id),
  code text unique not null,
  start_at timestamptz not null,
  spend_usd numeric not null default 0,
  status text not null default 'active'
);

create table attributions (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id),
  customer_id uuid not null references customers(id),
  order_at timestamptz not null,
  order_value numeric not null,
  kit_registered boolean not null default false,
  retested boolean not null default false,
  improved boolean
);

create table allocator_runs (
  id uuid primary key default gen_random_uuid(),
  run_at timestamptz not null default now(),
  budget_usd numeric not null,
  posterior jsonb not null,
  allocation jsonb not null
);

create table settings (
  key text primary key,
  value jsonb not null
);

-- Indexes for the lookups the app makes constantly.
create index kits_customer_id_idx on kits (customer_id);
create index kits_state_idx on kits (state);
create index kit_events_kit_id_at_idx on kit_events (kit_id, at);
create index panels_customer_id_idx on panels (customer_id);
create index biomarker_results_panel_id_idx on biomarker_results (panel_id);
create index tickets_customer_id_idx on tickets (customer_id);
create index tickets_kit_id_idx on tickets (kit_id);
create index attributions_campaign_id_idx on attributions (campaign_id);
