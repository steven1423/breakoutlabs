-- M4: growth engine support.
-- api_cache stores every YouTube and Instagram response so quota is spent once and rows are reproducible.
-- creators.enrich_error keeps the reason an enrichment failed (personal account, rate limit) next to the row.
-- youtube_quota is the per-day counter that refuses the 61st search.list call (CLAUDE.md §8.2).

create table if not exists api_cache (
  key text primary key,
  payload jsonb not null,
  fetched_at timestamptz not null default now()
);
alter table api_cache enable row level security;
-- No policies: only the service role (server) reads or writes the cache.

alter table creators add column if not exists enrich_error text;

insert into settings (key, value) values
  ('youtube_quota', '{"date": "", "search_calls": 0}'::jsonb)
on conflict (key) do nothing;
