-- M1: RLS on every table. Only the `staff` role has policies; anon and authenticated see nothing.
-- The app server acts as staff through the secret key until accounts exist (see docs/DECISIONS.md).
-- The `copilot` role and its masked views arrive in M3.

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'staff') then
    create role staff nologin;
  end if;
end $$;

grant usage on schema public to staff;
grant select on all tables in schema public to staff;
grant insert, update on kits, kit_events, tickets, pending_actions, settings to staff;
alter default privileges in schema public grant select on tables to staff;

do $$
declare t text;
begin
  for t in
    select table_name from information_schema.tables
    where table_schema = 'public' and table_type = 'BASE TABLE' and table_name <> 'schema_migrations'
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy staff_select on public.%I for select to staff using (true)', t);
  end loop;
end $$;

create policy staff_insert on kits for insert to staff with check (true);
create policy staff_update on kits for update to staff using (true) with check (true);
create policy staff_insert on kit_events for insert to staff with check (true);
create policy staff_insert on tickets for insert to staff with check (true);
create policy staff_update on tickets for update to staff using (true) with check (true);
create policy staff_insert on pending_actions for insert to staff with check (true);
create policy staff_update on pending_actions for update to staff using (true) with check (true);
create policy staff_insert on settings for insert to staff with check (true);
create policy staff_update on settings for update to staff using (true) with check (true);
