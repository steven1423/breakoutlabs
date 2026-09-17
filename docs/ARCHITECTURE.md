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

Postgres on Supabase. Four migrations under `supabase/migrations` (types and tables, roles and RLS, settings and seed support, a grant), applied over HTTPS by `scripts/migrate.mts`. Generated types live in `lib/db/types.ts`. The synthetic generator in `lib/synthetic` is pure: one `Rng` seeded with `breakoutos-v1` drives customers, kits and events, panels and biomarkers, engagement, tickets, creators and attribution, in that order. `supabase/seed.mts` wipes and reloads the tables through PostgREST. Server pages read through `createServiceSupabase()` in `lib/db/server.ts`.

## State machine (M2)

`lib/state-machine` is pure: `transitions.ts` (legal moves, `transition()`), `sla.ts` (SLA table, `isStuck`, `stuckReason`, `slaStatus`), `sweep.ts` (`planSweep()` decides what to write). `db.ts` is the only writer: `applyTransition()` for staff fixes and `sweepStuckKits()` for the sweep, reachable from the `/ops` button (server action), `pnpm sweep`, and `POST /api/sweep` behind `CRON_SECRET`.

## Copilot (M3)

`lib/copilot`: `guard.ts` (pure SQL whitelist), `tools.ts` (ten zod-typed tools over the service client; `run_readonly_query` calls `copilot_run_readonly_query`, which switches to the `copilot` role and can only read masked views in schema `copilot`), `provider.ts` (the vendor-neutral `ModelProvider` interface) with `providers/anthropic.ts` and `providers/gemini.ts` behind `MODEL_PROVIDER`, `loop.ts` (streaming tool-use loop over a provider, max 8 calls, retries, transparency records), `summarize.ts` (ticket summary cached to `tickets.ai_summary`), `index.ts` (wiring, `createProvider()`). `POST /api/copilot` streams server-sent events to `components/copilot.tsx`; every answer carries a transparency panel. Proposals land in `pending_actions` and are confirmed or rejected by server actions. `pnpm eval` runs `evals/copilot.json`.

## Growth (M4)

`lib/creators`: `types.ts` (the §8.1 `CreatorSource` interface, stubs and profiles), `youtube.ts` (Data API v3 adapter: discovery, enrichment through channels, uploads playlist and videos, pure parsers), `instagram.ts` and `search.ts` (Business Discovery and Serper behind their keys), `crosslinks.ts` (handle regexes), `pricing.ts` (tier bands), `quota.ts` (the daily search counter), `card.ts` (the §8.6 card through `completeJson`), `db.ts` (cache, quota store, upserts), `discover.ts` (the run the button, `pnpm discover` and `POST /api/creators/discover` share). `lib/attribution`: `metrics.ts` (the §8.7 formulas) and `queries.ts` (one row per campaign). `lib/allocator`: `thompson.ts` (posterior, Beta sampling, floor and cap, cents) and `db.ts` (weekly run persisted to `allocator_runs`). Pages: `/growth` (leaderboard with the FLIP toggle, creator table, Discover), `/growth/creators/[id]` (profile, card, cross-links, campaign metrics), `/growth/allocator` (runs and posterior curves).

## Model (M5)

`lib/model/formulas.ts` is pure: `project(inputs)` returns one row per month (new customers, kit revenue, members, membership revenue, retested cumulative, brand revenue, ARR, valuation) from the §11 formulas plus three documented one-line additions. `lib/model/url.ts` serialises the inputs to the query string. `components/model-calculator.tsx` (client) holds the sliders, the counting outputs and the one recharts chart; `components/model-timeline.tsx` links each year's milestone to the page that unlocks it. No database.

## Intelligence and brand (M6)

`lib/intelligence/guard.ts` is the one read path: `guardedAggregate(rows, query, minCohort)`. `queries.ts` builds the per-customer rows on the server; `index.ts` (`openIntelligence`) loads once and aggregates many; `settings.ts` reads and writes `settings.min_cohort`; `csv.ts` serialises cells. `GET /api/aggregates` parses dimensions, measure and filters and returns JSON or CSV of guarded cells; it has no row mode. The `/intelligence` page renders the state grid, the marker-delta small multiples (recharts), the retention table, the coverage heatmap and the guardrails widget. `lib/brand/simulate.ts` is a pure seeded simulation; `/brand` feeds it guarded baselines only.

## Loop

Test → Blueprint → Track → Retest → Data → Growth → Test. Ops owns the first four arcs, Intelligence owns Data, Growth owns the last.
