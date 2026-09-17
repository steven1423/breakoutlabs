# Decisions

Every non-obvious choice gets an entry: what, why, the alternative considered. Newest milestone at the bottom. Keep entries to a few lines so they can be said out loud in an interview.

## M0 — Scaffold

### Supabase publishable/secret keys under the CLAUDE.md §15 names
- What: `NEXT_PUBLIC_SUPABASE_ANON_KEY` holds the publishable key (`sb_publishable_…`); `SUPABASE_SERVICE_ROLE_KEY` holds the secret key (`sb_secret_…`).
- Why: Supabase replaced the legacy anon and service-role JWTs with publishable and secret keys, and `@supabase/ssr` accepts the new keys unchanged. Keeping the §15 names keeps CLAUDE.md, `.env.example` and Vercel settings in sync.
- Alternative: new names such as `SUPABASE_PUBLISHABLE_KEY`. Rejected because it forks the naming in CLAUDE.md.

### Hand-written scaffold instead of create-next-app
- What: package.json, tsconfig, next.config, postcss, eslint and vitest configs were written by hand.
- Why: create-next-app refuses a non-empty directory and adds boilerplate we would delete. Hand-writing keeps every file small enough to explain line by line.
- Alternative: run create-next-app in a temp folder and copy. Rejected as more steps for the same result.

### Exact versions, with TypeScript 6 and ESLint 9 rather than the latest tags
- What: `.npmrc` sets `save-exact`. TypeScript is pinned to 6.0.3 (not 7.0.2) and ESLint to 9.39.5 (not 10).
- Why: TypeScript 7 is the native compiler and ships no JS API, which Next's build-time type check and the ESLint TypeScript parser both load; Next's own install target is `typescript@^6`. ESLint 10 removed an API that `eslint-plugin-react` (pulled in by `eslint-config-next`) still calls.
- Alternative: Next's `typescript-cli` mode with TypeScript 7. Rejected until the ESLint side catches up; revisit in M7.

### Persona in the URL query, read by one client component
- What: `?as=support|growth|founder|brand` is the only persona state. The left rail is a client component inside `<Suspense>`; everything else in the shell is server rendered.
- Why: CLAUDE.md M0 puts persona state in the URL. A Next layout cannot read search params on the server, so the rail reads them on the client and the Suspense boundary keeps the rest static.
- Alternative: a cookie, or a route segment per persona. Rejected: a cookie is invisible state, and segments would make personas look like separate apps.

### Personas re-order the rail rather than hide sections
- What: every persona sees all four sections; their own section is pinned first and their label is highlighted.
- Why: CLAUDE.md §2 says personas re-skin navigation and copy but never change data access. Hiding sections would suggest access control that does not exist.
- Alternative: a different nav per persona. Rejected for the reason above.

### Tailwind 4 CSS-first config, tokens as CSS variables
- What: no `tailwind.config.ts`. The §14 tokens live in `app/globals.css` as CSS variables and are mapped into utilities with `@theme inline`. Light mode overrides the variables under `prefers-color-scheme: light`.
- Why: Tailwind 4 configures itself in CSS, and CSS variables let the light variant honour the viewer's setting with no theme switcher.
- Alternative: Tailwind 3 with a JS config. Rejected: an older major for no gain.

### Light variant darkens the garnet, teal and amber
- What: in light mode the accent, live, seeded and biomarker-flag tokens shift to darker ink versions of the same hues.
- Why: the §14 values are tuned for the petrol background; on white they fall under 4.5:1 contrast for text, and M7 requires Lighthouse accessibility ≥ 95.
- Alternative: identical hex values in both modes. Rejected on contrast.

### Shared UI lives in `components/`
- What: badge, page header, empty state and rail live in a root `components/` folder.
- Why: §4 has no home for shared UI, and a root `components/` folder is the Next.js convention.
- Alternative: `app/(app)/_components`. Rejected because the badge is also needed outside the app shell.

### Scripts and packages arrive with their milestone
- What: M0 ships `dev`, `build`, `start`, `lint`, `typecheck`, `test`. `seed`, `eval`, `discover`, `sweep` and the packages they need (seedrandom, @anthropic-ai/sdk, recharts) are added by M1, M3 and M4.
- Why: a script that prints "not built yet" is a stub that looks built, which §16.4 forbids.
- Alternative: stub the scripts now. Rejected.

### Two dev dependencies beyond the §3 list: jsdom and @tailwindcss/postcss
- What: added as dev dependencies.
- Why: `@testing-library/react` cannot render without a DOM implementation, and Tailwind 4 requires its PostCSS plugin. Both are requirements of packages already in the list, not new capabilities.
- Alternative: happy-dom. Rejected because jsdom is what Testing Library documents.

### AGENTS.md hosts the block that `next dev` writes
- What: Next 16 appends a managed "agent rules" block to CLAUDE.md or AGENTS.md whenever a coding agent runs `next dev`. A committed `AGENTS.md` that points at CLAUDE.md now hosts that block.
- Why: CLAUDE.md is the source of truth and must not be edited by tooling. Next prefers an existing AGENTS.md, so the block lands there and the tree stays clean.
- Alternative: revert CLAUDE.md after every dev run. Rejected as a recurring diff waiting to be committed by mistake.

### Model id from `CLAUDE_MODEL`, default `claude-sonnet-5`
- What: `.env.example` sets `CLAUDE_MODEL=claude-sonnet-5`; `CLAUDE_EFFORT` is reserved for the copilot's effort level and is proposed in the M3 plan.
- Why: CLAUDE.md §3 and §15 name that default. Nothing in M0 calls the model.
- Alternative: none.

## M1 — Schema and synthetic data

### Migrations run over HTTPS through the Management API
- What: `pnpm migrate` posts each `supabase/migrations/*.sql` file to the Management API SQL endpoint and records it in `schema_migrations`. `pnpm gen:types` uses the same access token.
- Why: the project's direct Postgres host is IPv6-only and this sandbox has no IPv6, so `supabase db push` cannot connect. The SQL endpoint runs as the `postgres` role, which is enough for DDL.
- Alternative: the IPv4 Supavisor pooler. Rejected for migrations because it needs a password in the environment and a Postgres client; M3 may still need it for the copilot role.

### Forward-only migrations, even for a fix
- What: the grant that lets `postgres` impersonate `staff` is its own file (`0004`) rather than an edit to `0002`.
- Why: applied files are never edited, so any environment can be brought to the same state by running the list in order.
- Alternative: reset the database and re-run. Rejected because it is a destructive step for a one-line change.

### `staff` is a real role with policies; the server uses the secret key for now
- What: RLS is on for every table. Only `staff` has policies (read everything, write kits, kit_events, tickets, pending_actions, settings). `anon` and `authenticated` have no policies and see zero rows. The Next server reads through the secret key (`service_role`), which bypasses RLS.
- Why: personas are a switcher, not accounts (cut list), so there is no user JWT to carry a role. The policies still exist and are exercised through `set role staff` in verification, so wiring a real staff JWT later is a change to the client, not the schema.
- Alternative: mint a `staff` JWT on the server. Rejected for M1 as extra machinery with no user model behind it.

### Determinism: fixed "today", every id and timestamp from the generator
- What: the generator anchors "today" to a constant (`TODAY_MS`, 2026-09-16) and supplies every uuid and timestamp itself. The seed script never lets the database default a column.
- Why: the definition of done is identical counts and checksums across two runs. A `now()` default or a real clock would break that silently.
- Alternative: derive "today" from the run date. Rejected; bump the constant before the demo instead.

### Exact quotas for plan, age, sex and channel
- What: those four fields are assigned from shuffled quota lists so their shares match §12 exactly; segment, region, consent and retest are drawn per person.
- Why: at n=500 a plain weighted draw can miss a share by two standard deviations, and the tests would fail for a good seed.
- Alternative: widen test tolerances. Rejected because exact shares are easier to explain.

### Driver markers are always out of range at baseline
- What: a segment's driver markers are redrawn (at most four times, then clamped just past the range) until they flag on the driven side.
- Why: §12 says "androgen → high testosterone/DHEA-S, low SHBG". A normal draw around the driven center still lands in range about one time in six, which would make the segment rule false for some customers.
- Alternative: keep the noise. Rejected.

### Non-retesting customers accumulate in `retest_due`
- What: about 60% of baseline kits sit in `retest_due` because their customers never ordered a retest. The state machine has no "lapsed" state.
- Why: that is the retest leak the product is about. M2 will report those separately from ops exceptions so the stuck queue is not swamped.
- Alternative: invent a `lapsed` state. Rejected; §5's enum is the spec.

### `reset_synthetic_data()` is a security-definer function
- What: the seed calls one RPC that truncates the synthetic tables; only `service_role` may execute it.
- Why: PostgREST has no truncate, and a filtered delete over fourteen tables is slower and easier to get wrong.
- Alternative: run the truncate through the Management API. Rejected so `pnpm seed` needs only the secret key.

### The 40 cached YouTube creators wait for M4
- What: M1 seeds the 30 Instagram and TikTok creators and all 15 campaigns; the YouTube snapshot lands with the adapter that produces it.
- Why: the snapshot is the output of a live pull, and there is no adapter yet.

### `"type": "module"` in package.json
- What: the package is ESM.
- Why: the seed and migrate scripts run on Node's built-in TypeScript support, which needs the module type to be explicit or warns on every run. Next 16, Vitest and ESLint all accept ESM packages.

## M2 — State machine and stuck sweep

### The transition table is data, and the database layer is one file
- What: `lib/state-machine/transitions.ts` holds a map of legal next states and a pure `transition()` that returns the new kit plus the event to record. `lib/state-machine/db.ts` is the only code that writes `kits` and `kit_events`.
- Why: CLAUDE.md §6 asks for a pure machine with no database calls. Keeping writes in one file means every state change in the product produces an event, which the timeline depends on.
- Alternative: transitions inside a database trigger. Rejected because the rules would live where tests cannot reach them.

### Cancel and refund from any non-terminal state
- What: `cancelled` and `refunded` are legal exits from every non-terminal state.
- Why: §6 names them terminal but gives no entry rule, and support needs both from anywhere.
- Alternative: refund only after `sample_received`. Rejected as a business rule we do not know.

### Retention states get nudges, not tickets
- What: kits stuck in `viewed` or `retest_due` count as stuck and get a nudge proposal, but the sweep never opens a support ticket for them.
- Why: about 300 baseline kits sit past the `retest_due` SLA. One ticket each would bury the 40 ops exceptions nobody else is watching. A lapsed customer is a growth problem, and the nudge is the growth action.
- Alternative: a ticket per lapsed customer. Rejected because nobody would work that queue.

### The sweep is a planner plus a writer
- What: `planSweep()` is pure and returns what to write; `sweepStuckKits()` loads, plans, writes. Idempotency comes from the planner reading open tickets and proposed nudges.
- Why: the idempotency test then runs in memory with a fake store, and a second sweep against the real database is shown to write nothing in the PR.
- Alternative: unique constraints in the database. Rejected for M2 because "one open ticket per kit" is a rule about status, which a unique index cannot express cleanly.

### An open customer ticket is classified, not duplicated
- What: when a stuck kit already has an open ticket with no `likely_cause`, the sweep sets the cause on it instead of opening a second one.
- Why: the customer usually complains before the SLA passes. The ticket they opened is the one support should work, now labelled.

### SLA hours come from settings, merged over the §6 defaults
- What: `mergeSlaHours()` overlays `settings.sla_hours` on the code defaults, ignoring unknown states and bad values.
- Why: §6 says overridable; the defaults keep the machine working when the row is missing or malformed.

### The cron route refuses without a secret
- What: `POST /api/sweep` needs `Authorization: Bearer CRON_SECRET`, and returns 503 if the secret is not configured.
- Why: the route writes tickets. An unconfigured deploy should not be sweepable by anyone who finds the URL. The staff button on `/ops` is a server action and does not use the route.

### Node 22.18 or newer
- What: `engines.node` is now `>=22.18`.
- Why: the seed, migrate and sweep scripts run TypeScript through Node's built-in type stripping, which shipped unflagged in 22.18. CLAUDE.md says Node 20+; that predates the scripts.

## M3 — Copilot

### The model's SQL runs as `copilot` through two security-invoker functions, not a second connection string
- What: `copilot_run_readonly_query` and `copilot_explain_query` are public functions executable only by `service_role`, which is granted membership in `copilot` and switches to it with `set local role` inside the function. Only masked views in schema `copilot` are readable; public tables are denied.
- Why: the direct Postgres host is IPv6-only and unreachable from the sandbox, so `SUPABASE_COPILOT_DB_URL` could not be exercised. The function gives the same privilege boundary over HTTPS and was probed: views readable, base tables denied, 200-row cap, anon cannot execute.
- Alternative: security definer functions. Rejected because Postgres forbids `SET ROLE` inside them (migration 0005 tried it, 0006 corrected it).

### The 5-second timeout is enforced by the client, not the function
- What: `set_config('statement_timeout')` inside a running statement does not re-arm the timer, so the RPC call carries an `AbortSignal.timeout(5000)`, the guard rejects `pg_sleep`, and `alter role copilot set statement_timeout` covers any direct connection.
- Why: measured: a `pg_sleep(10)` through the function completed. The client abort is the guarantee the app can actually give.

### Guard first, then EXPLAIN, then run
- What: `guardSql` is a pure whitelist (one `select` or `with`, no semicolons, comments, locks, `into`, writes, settings, sleep or file functions). A passing query is planned with `explain` as the copilot role before it runs.
- Why: the guard stops obvious misuse in-process; the explain catches bad SQL and privilege errors without executing; the role is the real boundary.

### Typed tools use the service client; only raw SQL uses the copilot role
- What: nine tools run fixed queries we wrote, selecting masked columns and truncating ticket bodies to 500 characters. `run_readonly_query` is the only path where model-written SQL reaches Postgres, and it runs as `copilot`.
- Why: CLAUDE.md §7 says the model never gets raw SQL except through that one tool. Fixed queries need the joins and settings the views do not expose.

### Manual streaming loop, not the SDK tool runner
- What: `runCopilot` streams each turn through a `ModelProvider`, executes the tool calls it returns, appends the results, stops at end_turn or after 8 calls, then makes one last turn with tools disabled so the model still answers.
- Why: the transparency panel needs per-call timing and row counts, the cap needs a graceful last turn, and the route needs a custom SSE transport. The tool runner is beta and hides those seams.

### Last login is derived, not stored
- What: "days since last login" is the latest customer-actor kit event or check-in.
- Why: §5 has no login table, and adding a column would change the schema for one question.

### Effort defaults to medium
- What: `output_config.effort` comes from `CLAUDE_EFFORT`, validated against low, medium, high, xhigh, max; anything else falls back to medium. Sonnet 5 runs adaptive thinking, so no thinking parameter is sent.
- Why: the copilot answers factual questions through tools where latency matters more than depth. Raise it per deployment if answers feel thin.

### Ticket summaries are JSON in text, validated by zod, retried once
- What: the summariser asks for one JSON object, parses the first `{...}`, validates against `aiSummarySchema`, and re-asks once with the validation error before giving up.
- Why: one plain request is easier to explain than structured-output configuration, and the schema check is what makes the cache trustworthy.

### Confirm is the whole action
- What: Confirm and Reject set `pending_actions.status` and `decided_at`. No send exists.
- Why: Klaviyo, SendGrid and Twilio are on the cut list; the table is the audit trail a later integration would consume.

### Gemini is the demo provider; Anthropic stays the default
- What: `MODEL_PROVIDER=gemini` routes the copilot and the ticket summariser through Gemini (`GEMINI_API_KEY`, `GEMINI_MODEL`, default `gemini-2.5-flash`). Unset or `anthropic` keeps the CLAUDE.md path (`ANTHROPIC_API_KEY`, `CLAUDE_MODEL`). The badge reason names the vendor and model that answered.
- Why: the Anthropic account had no credits when the M3 evals were due, and the demo is a video, not a code review. Gemini's free tier ran all 15 evals. Steven chose this; it is an environment switch, not a code fork.
- Alternative: wait for Anthropic credits. Rejected because the M3 definition of done needs the evals to pass now and nothing in the product depends on which vendor answers.

### One `ModelProvider` interface, two adapters
- What: `lib/copilot/provider.ts` defines a neutral turn (`streamTurn`) and a one-shot `complete`. `providers/anthropic.ts` and `providers/gemini.ts` translate the neutral history to each vendor's shape and back; the loop, tools, guard and evals never see vendor types. Each adapter keeps the raw assistant parts so a replayed turn is byte-identical (Anthropic content blocks, Gemini parts with thought signatures).
- Why: the loop is the part a CTO reads; it should not change when the vendor does. Retries on 429/503/529 live in the loop once.
- Alternative: a `switch` inside the loop. Rejected because every vendor difference (tool_choice vs omitting tools, tool_result vs functionResponse) would leak into the part that is supposed to be simple.

### `@google/genai` is the one dependency beyond §3
- What: the official Google SDK, pinned exactly. It is only imported by the Gemini adapter and `createProvider()`.
- Why: the demo override needs it; hand-rolling the streaming and function-calling wire format would be more code to explain than the SDK.

### Effort maps to a Gemini thinking budget
- What: `CLAUDE_EFFORT` low, medium, high, xhigh, max become `thinkingBudget` 0, 1024, 4096, -1, -1 (dynamic) on Gemini. Anthropic keeps `output_config.effort`.
- Why: one env var controls depth on both vendors, so the docs and the demo setup do not fork.

### Gemini runs at temperature 0
- What: both Gemini calls set `temperature: 0`. Anthropic is left at its default.
- Why: at the default temperature Gemini picked a different tool for the same question on repeated runs (get_metric instead of run_readonly_query for "run a query"). The copilot is a data tool; reproducible tool choice matters more than varied prose. Evals passed 15/15 on two consecutive runs after the change.

### An empty model turn is retried, not shown
- What: when Gemini returns neither text nor a function call (its `MALFORMED_FUNCTION_CALL` finish, or a dropped part), the adapter throws a retryable `EmptyTurnError` and the loop re-samples the turn on the same 2 s, 4 s, 8 s schedule as rate limits.
- Why: it happened once in the eval runs and produced a blank answer. Re-sampling is the documented remedy and costs one call.

### The model is told the view schema and its call budget
- What: the `run_readonly_query` description lists every masked view and its columns; the system prompt says explicitly that "run a query" or "SQL" means that tool, that "send", "text" or "nudge" means look up the recipients and call `propose_action` once per customer, and that there are at most 8 tool calls per question. `get_kit_timeline` now returns the kit's tickets so a kit code leads to a ticket id in one typed call.
- Why: eval failures traced to missing facts, not model quality: six SQL attempts guessing column names, a refusal to nudge because the old rule said "decline any send", and a search for a ticket id that no typed tool exposed. Giving the model the facts fixed each case; loosening the evals would have hidden them.
