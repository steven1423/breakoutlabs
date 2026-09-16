# Architecture

One diagram and one page. The diagram arrives in M7; this file grows one short section per milestone.

## Shape after M0

Next.js App Router with two route groups. `(marketing)` holds the landing page. `(app)` holds the shell: a server layout with a 240px left rail and a content column. The rail is the only client component in the shell, because the active persona is read from the URL query (`?as=`), which a server layout cannot see. Pages are server components.

```
app/
  (marketing)/page.tsx     landing: thesis + Enter
  (app)/layout.tsx         shell: rail (client, in Suspense) + content column
  (app)/ops, growth, growth/allocator, intelligence, brand, model
components/                 badge, page header, empty state, rail
lib/personas.ts             persona parsing, rail order, link building (pure)
lib/env.ts                  validated env + "is this integration configured"
lib/db/                     Supabase clients: server (cookies, RLS) and browser
```

## Data (M1)

Not built yet. Migrations under `supabase/migrations`, generated types in `lib/db/types.ts`, synthetic seed under `lib/synthetic`.

## Copilot (M3)

Not built yet. A restricted Postgres role reading masked views in schema `copilot`; typed tools; a transparency panel.

## Loop

Test → Blueprint → Track → Retest → Data → Growth → Test. Ops owns the first four arcs, Intelligence owns Data, Growth owns the last.
