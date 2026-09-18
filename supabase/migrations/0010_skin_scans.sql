-- M11: consented skin scans. The scan runs on the subject's own device; only the summary is kept.
-- No image, no descriptor, no embedding is ever stored: `frames` holds per-frame metadata (angle,
-- pose, crop size, lesion count), which is what the evidence panel lists.

create type scan_subject as enum ('creator', 'customer');
create type severity_band as enum ('clear', 'mild', 'moderate', 'marked');

create table skin_scans (
  id uuid primary key default gen_random_uuid(),
  subject_type scan_subject not null,
  subject_id uuid not null,
  consented_at timestamptz not null,
  taken_at timestamptz not null default now(),
  model text not null,                   -- detector manifest name and date
  frames jsonb not null,                 -- FrameResult[] without pixels
  frame_count int not null check (frame_count between 1 and 12),
  lesions_per_frame numeric not null,
  lesions_max int not null,
  per_zone jsonb not null,               -- ZoneCount[]
  band severity_band not null,
  mean_score numeric,
  low_resolution boolean not null default false,
  spoof_flag boolean not null default false
);

create index skin_scans_subject_idx on skin_scans (subject_type, subject_id, taken_at desc);

alter table skin_scans enable row level security;
grant select, insert on skin_scans to staff;
create policy skin_scans_staff_read on skin_scans for select to staff using (true);
create policy skin_scans_staff_insert on skin_scans for insert to staff with check (true);
