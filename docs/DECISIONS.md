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

## M4 — Growth

### Last 12 uploads come from the uploads playlist, not a second search
- What: enrichment reads `playlistItems.list` on the channel's uploads playlist (1 unit) and then one `videos.list` batch (1 unit), instead of the `search.list channelId=… order=date` call §8.2 names (100 units, and one of the 60 daily searches).
- Why: a 40-channel run would otherwise cost 54 of the 60 daily search calls and about 5,400 units, leaving no room for a retry. A full run now costs 14 searches and about 1,500 units. Agreed with Steven in the M4 plan.

### Every API response is cached for a day in `api_cache`
- What: adapters look up `api_cache` by request key before calling out; a hit is served without spending quota. Rows enriched from a cached response still carry `enriched_at` from the cache's fetch time.
- Why: quota is the scarce thing, re-runs must be cheap, and the cache is what makes the snapshot reproducible. A day is short enough that the demo shows current numbers.
- Alternative: no cache and a smaller run. Rejected: a second Discover click on demo day would fail on quota.

### Each query is capped so all seven contribute
- What: discovery asks for `ceil(limit / queries)` results per query and type, takes the first 40 unique channels, then enriches.
- Why: the first run let "hormonal acne journey" fill all 40 slots and never ran the other six queries. Breadth across PCOS, spironolactone and accutane content is the point of the query list.

### The snapshot is the handles from one run, written as a TypeScript module
- What: `pnpm discover` writes `lib/synthetic/youtube-snapshot.ts` with exactly the channels that run found; the seed appends them as `data_status='seeded'`, `source='youtube_api'` rows after the campaign draws so the story campaigns do not move.
- Why: §12 wants 40 cached YouTube creators that reproduce under `pnpm seed`, and honest labels: a snapshot is not Live until the running build re-fetches it. A `.ts` module avoids JSON import attributes, which differ between Node, Vite and Turbopack.

### Cross-links are rows, not a relation
- What: handles found in channel and video descriptions become Seeded `creators` rows (`source='youtube_api'`) with `ignoreDuplicates`, so an existing seeded creator is never overwritten. The creator page re-extracts handles from the stored bio to show its cross-links.
- Why: §5 has no link table and adding one would change the schema for a display detail. Re-extracting from the bio is pure and costs nothing.

### Instagram and search adapters are built, tested on fixtures, and hidden when unconfigured
- What: `InstagramSource` (Business Discovery, engagement over the last 12 posts, errors stored in `creators.enrich_error`) and `SearchSource` (Serper, handles from result URLs only) exist behind `META_*` and `SEARCH_API_KEY`. The UI shows "Not configured" with the Seeded badge instead of hiding the button.
- Why: §16 says never fake an integration. The keys are absent in this environment, so neither adapter has been exercised against the live API; the parsers are unit-tested on the documented response shapes.

### The price band is computed in code, not by the model
- What: `priceBand()` applies the §8.6 tiers and the ±30% engagement adjustment. The card prompt receives the estimate and must echo it; after validation the computed values overwrite whatever the model returned.
- Why: a number a founder will quote in a negotiation should come from a rule he can read, not from a sample. The card's judgement (fit, segment, angle, draft) is the model's; the arithmetic is ours.

### One `completeJson` helper for the summariser and the card
- What: `lib/copilot/json.ts` asks the provider once, validates with zod, and retries once with the validation error. The M3 summariser now calls it.
- Why: two copies of the same retry loop would drift. This is the one refactor in M4 and it is its own commit.

### Attribution metrics are pure and nulls mean "no denominator"
- What: `campaignMetrics()` returns `null` for CAC, cost per registered, cost per retest and retest rate when the denominator is zero; the UI renders a dash. LTV counts at most three membership months per attributed customer.
- Why: a new campaign with no retests should sort last on cost-per-retest, not show Infinity. Three months is the 90-day window §8.7 defines.

### Posterior Beta(1 + retested, 1 + orders − retested), seeded by ISO week
- What: the uniform prior updated by each campaign's attributed orders and retests. The weekly run's random source is `seedrandom("allocator-<ISO week>")`, so pressing Run twice in one week reproduces the draw; a new week draws afresh.
- Why: §8.8 allows an informed prior; the attribution rows are the best information we have. Seeding by week makes the demo repeatable and the tests exact.

### Floor and cap by water-filling, cents by largest remainder
- What: shares ∝ sampled θ are clamped to [5%, 40%], and the shortfall is handed to campaigns with headroom in proportion to it until nothing moves. Whole cents sum to the budget; leftover cents go one each to the largest remainders.
- Why: the first implementation could leave money unspent when every campaign was pinned at a bound (test case: two at the cap, one at the floor). Water-filling always spends the budget when 5%·n ≤ 100% ≤ 40%·n.

### Density curves are inline SVG, not recharts
- What: `BetaCurve` draws the Beta density with one SVG path and marks the sampled draw; it renders on the server.
- Why: the plan listed recharts, but a 40-point sparkline without axes does not need a chart library or a client bundle. Recharts stays reserved for the M5 model and M6 intelligence charts, where axes and tooltips matter.

### The leaderboard reorder is a FLIP transition on the rows
- What: the client component records each row's top before the re-render, then animates from the old offset to zero with the Web Animations API. `prefers-reduced-motion` skips the animation.
- Why: §14 allows motion only in response to actions and no animation library. FLIP is twenty lines and the rows stay real table rows.

### Email addresses are redacted at ingestion
- What: `redactEmails()` runs on every bio, description and title an adapter returns before the row is built, so `creators` never holds an address, and the seed's privacy test (no email anywhere in the dataset) covers the YouTube snapshot too.
- Why: channel descriptions carry business emails. They are public, but §16 says never store a real email, and the rule is simpler with no exceptions. The first snapshot failed the privacy test; this is the fix.

### One-shot Gemini calls get the same 8,000-token limit as streamed turns
- What: `complete()` on the Gemini provider had `maxOutputTokens: 1000`; it is now 8,000, matching `streamTurn()`.
- Why: Gemini counts thinking tokens against the output limit. The creator card for a long channel description spent 788 tokens thinking and was cut off at 196 tokens of JSON (finish reason MAX_TOKENS, measured). The M3 ticket summaries were shorter and passed by luck.

## M5 — Model

### The formulas are §11 as written, plus three one-line additions
- What: `lib/model/formulas.ts` implements every §11 line literally, including brand revenue as `(retested_cum / 12) × partner_gmv_per_year / 12 × take_rate`. Three additions, each one line and each named in the page's footnote: retests count three months after the order (a retest is a 90-day event); "ramps from month 18" is a linear ramp to 100% at month 24; and churn applies only to members who have not retested (`effective churn = churn × (1 − retest rate)`, after month 3).
- Why: without the churn coupling the retest slider barely reaches the valuation, because §11 routes retests only into brand revenue, which is small at the defaults (about $17K of ARR at month 36 against $14M). The definition of done needs the slider to move the number, and "retested members stay" is the thesis of the product. Steven gave latitude to make up what §11 leaves open; all three are documented and reversible.
- Alternative: reading the first `/12` in the brand formula as a typo (12× more brand revenue). Rejected because CLAUDE.md wins on a written formula and even the larger reading does not make the retest slider matter on its own.

### Inputs live in the URL
- What: `lib/model/url.ts` writes only non-default inputs to the query string and clamps what it reads to the slider bounds. The timeline's Year 2 link is `/model?plan=membership_first`.
- Why: a linkable state is what makes the timeline honest ("this milestone is that setting") and lets Steven send a specific scenario. Junk in the URL falls back to defaults rather than breaking the page.

### Outputs count to their new value; the chart does not animate
- What: `CountUp` eases the six output tiles over half a second and is skipped under `prefers-reduced-motion`. The recharts areas have animation off.
- Why: §14 allows motion only in response to actions and names "the model outputs counting to their new value". Animating the areas as well would compete with the tiles.

### Chart colours are re-stepped tokens, validated
- What: three CSS variables (`--chart-membership`, `--chart-kits`, `--chart-brand`) in the amber, teal and garnet hue family, one set per colour scheme. The stack order puts teal between amber and garnet. Both sets pass the dataviz palette validator (lightness band, chroma floor, CVD and normal-vision separation, contrast); the dark set carries a contrast warning on garnet, answered by the legend and the month-by-month table under the chart.
- Why: the §14 tokens as-is fail the validator as a categorical set (teal reads grey, amber is too light on the dark surface, amber and garnet are too close as neighbours). The chart keeps the family and fixes the steps; the product tokens are untouched.

### recharts, added here
- What: one stacked area chart of ARR by source. `recharts` is the §3 chart library and this is its first use.
- Why: this chart needs axes, a legend and a hover tooltip; the M4 sparklines did not. One library for all charts from here on.

## M6 — Intelligence and brand

### One read path, and the minimum applies to the cohort a number describes
- What: `guardedAggregate(rows, query, minCohort)` is the only way a number reaches `/intelligence`, `/brand` or `/api/aggregates`. It filters to `consent_research`, groups by the requested dimensions, and suppresses any cell whose contributing rows number fewer than the minimum. For rates and marker deltas the contributing rows are the ones the measure is computed over (retested customers, customers with that marker), so a rate over 8 people is suppressed even inside a cell of 30.
- Why: k-anonymity is a promise about the group a figure describes. Checking the raw cell size would let a rate over a handful of people leak through a large cell.
- Alternative: suppress on the full cell count only. Rejected for the reason above.

### The prevalence map reports the leading segment per state, checked at the state grain
- What: the map cell is the state cohort (must reach the minimum), and its value is the share of the leading segment within it. The segment × state breakdown is not exported separately.
- Why: at 217 consenting customers, a segment × state grain suppresses every tile even at a threshold of 10. The state cohort is the honest grain for a map; the share within it describes that cohort.

### The demo threshold is 10; the code default stays 50
- What: migration 0008 sets `settings.min_cohort` to 10 for this dataset. `loadMinCohort` falls back to `MIN_COHORT` then 50 when the row is absent. The guardrails widget says both numbers.
- Why: CLAUDE.md sets 50 for production. The seed has 500 customers and about 217 consent, so at 50 nothing renders and nothing can disappear when the dial moves. At 10 the top states and the main segment × age cells show, the rest hatch, and raising to 20 on camera removes cells. Agreed in the M6 plan.

### Marker deltas are sign-normalised toward optimal
- What: `towardOptimal(before, after, low, high)`: a high marker falling is positive, a low marker rising is positive, an in-range marker moving toward the midpoint is positive. One hue per chart, sample size on every bar, suppressed markers listed under the chart rather than drawn.
- Why: eight markers with different directions of "better" would need a legend per marker. One sign, one colour, and the founder reads it in a second.

### The export endpoint has no row mode
- What: `GET /api/aggregates` accepts `dims`, `measure`, `marker`, `intervention`, `segment`, `age_band`, `region_state` and `format`. Unknown dimensions and measures are 400s. `rows`, `limit`, `customer_id`, `select` and `format=rows` are ignored: the parser has no branch for them, and the tests assert the parsed query is identical with and without them.
- Why: §9 says row-level export does not exist. The safest way to make that true is a parser that cannot express it.

### Row objects never leave the server
- What: `loadResearchRows` builds the per-customer rows the guard consumes; the page and the route call `openIntelligence().aggregate(...)` and only cells reach the client. The brand page passes guarded cells to its client component, never rows.
- Why: a client component that received rows would put them in the HTML.

### The brand simulation is pure, seeded, and honest about its control
- What: `simulate(inputs, baseline)` draws the funnel with `seedrandom` on the inputs, so the same picks give the same numbers. The control improvement rate is the guarded `improved_rate` for the chosen segment × age band; when that cell is suppressed the all-segment rate stands in and the page says so. Lift per segment is a labelled estimate, not a fit.
- Why: §10 asks for a deterministic simulation on the synthetic cohort with every number badged Seeded. Reading the control from the guard means the brand page cannot see anything the intelligence page could not.

## M7 — Landing, polish, docs

### The loop is SVG arcs with a CSS dash animation, no library
- What: six arcs on one ring (Test, Blueprint, Track, Retest, Data, Growth), each drawn by animating `stroke-dashoffset` with a per-arc delay, then the labels, the blood-spot mark, the three thesis lines and the button in sequence. Under `prefers-reduced-motion` the offsets are zeroed and nothing animates. No client JavaScript.
- Why: §14 allows one orchestrated moment and asks for no animation library. CSS custom properties per arc keep the timing in one stylesheet, and the page stays static HTML.
- Alternative: `framer-motion` on the landing page. Rejected as a dependency for one animation.

### The kit rail shows marks, once per page load
- What: each state on the `/ops` track renders one mark per kit, capped at 24 with a "+n" overflow, garnet for kits past their SLA; marks slide into place with a 12 ms stagger on first paint. The kit page passes no marks and keeps the plain track.
- Why: §14 names the rail as the memorable element on `/ops` and asks for motion only in response to actions, so the marks move on load and never on a data refresh.

### Contrast: the theme reset had removed Tailwind's white
- What: `globals.css` resets `--color-*` to keep the palette to the §14 tokens, which also removed `white`; `text-white` on accent buttons silently fell back to the body text colour, dark on garnet in light mode (Lighthouse measured 2.26:1). `--color-white` is now defined in the theme.
- Why: found by the M7 Lighthouse run on `/ops`. One token fixes every accent button.

### Accessibility pass
- What: a skip link to `main` in the app shell, `scope="col"` on every table header, a 404 that says what to try, an error boundary that names the failure and offers a retry. Focus rings and `aria-current` on the rail already existed.
- Why: the M7 definition of done is Lighthouse accessibility of 95 or more on `/ops` and `/`.

### Light-mode Live token darkened; no text at half opacity
- What: light `--live` and `--optimal` moved from #2a7f77 to #25736c so 13px badge text on the light background passes 4.5:1. "No data" tiles and cells use a dashed border instead of `opacity-50` on muted text.
- Why: Lighthouse on `/growth` and `/intelligence` in light mode. Opacity on text is a contrast bug waiting to happen; a dashed border says "empty" without dimming the label.

## M8 — Hardening after an adversarial review

Everything in this section was found by a preflight of the merged build and a nine-dimension hostile review, not by a user. Each entry says what was wrong, because a reviewer trusts a project that records its own defects more than one that reports only successes.

### The aggregate guard now limits how specific a query may be
- What: `guardedAggregate` refuses a query whose grouping dimensions plus active filters exceed three, counts filters toward that limit, and returns cells sorted by dimension value.
- Why: suppression hides a cell's count, not its existence. Asking for all seven dimensions at once returned 209 suppressed cells for 209 consenting customers, each one a unique quasi-identifier tuple, emitted in database order so the CSV was itself a join key back to the customers table. Every cell was correctly marked suppressed and the export was still a per-customer dump, on the endpoint whose own panel promises row-level export does not exist. Three dimensions covers every view in the product: the map uses one, retention two, coverage two plus a region filter.
- Alternative: redacting the dimension values of suppressed cells. Rejected because the hatched map needs to say which state is suppressed, and at three dimensions or fewer the cell label is public knowledge rather than a fingerprint.

### The raw query path is bounded in bytes, not only in rows
- What: migration 0009 adds a 128 KiB ceiling to `copilot_run_readonly_query`, `run_readonly_query` repeats the check in TypeScript so the limit holds against a database that has not been migrated, and the transparency panel prints the payload size beside the row count.
- Why: the wrapper was `select ... from (select * from (%s) q limit 200) t`, which bounds the rows the query emits and not the data inside them. One aggregating select is one row: `select jsonb_agg(row_to_json(b)) from biomarker_results b` returned 864 KB in a single row, roughly 200,000 tokens pasted into the model's context and reported to the reviewer as "1 row". Rows were never the right unit for a cap whose purpose is to bound what one call can drag back.
- What this does not fix, and the honest version to give a reviewer: a narrow aggregate still returns many records in one row. `select jsonb_agg(json_build_object('e',email_masked,'n',first_name)) from customers` is 18 KB and passes. There is no privilege boundary being crossed — the role can already read all 500 masked rows 200 at a time — so what the ceiling protects is context and cost, and what the byte count protects is the reviewer's ability to see that "1 row" held 18 KB. Counting records inside an arbitrary aggregate is not something a wrapper can do; the defence is the masked views, which is where it always was.
- Alternative: rejecting aggregate functions in the guard. Rejected because `count`, `avg` and `group by` are the tools the model should be reaching for, and the prompt now tells it to.

### Phone numbers are redacted, and the redaction now covers cached payloads
- What: `redactEmails` became `redactContacts`, which also removes phone numbers, and `redactPayload` applies it to the free-text fields of every cached API response before `api_cache` stores it.
- Why: §16.5 forbids storing a real email or phone number. Redaction ran on the profile but never on the raw response the cache kept, so 20 real personal email addresses sat in `api_cache`, including two addresses for the same named private individual. Three phone numbers and a clinic address also reached the committed snapshot. The rule is eager on purpose: nine digits in prose is treated as a phone number, because redacting a large number in a bio costs nothing and missing a real one is a violation.

### Discovery has a subscriber floor
- What: `MIN_SUBSCRIBERS = 1_000`, applied after enrichment, with four candidates oversampled per slot because a search call costs the same 100 units whether it returns five results or fifty.
- Why: 23 of the original 40 live channels had under 1,000 subscribers and six had fewer than four, so the leaderboard was mostly private individuals posting about their own acne while the docs claimed public professional-account data. A partnership prospect needs an audience; the floor makes the claim true and the leaderboard worth looking at.

### A channel with no uploads playlist no longer fails the run
- What: `recentVideos` returns no videos when the playlist read fails, instead of propagating a 404.
- Why: one channel in a forty-channel run had hidden its uploads playlist and killed the entire discovery run partway through.

### The brand portal never invents a control rate
- What: `Baseline.fallbackRate` is nullable and `simulate()` returns null when the guard leaves no usable control cohort; the page then explains that rather than showing numbers. The simulation also reports the lift it actually applied, and the retest window no longer seeds the funnel draws.
- Why: three defects in one screen. A hardcoded 0.5 was presented as a measured rate whenever the minimum cohort rose above 37, which is exactly what typing the specified default of 50 during the intelligence beat would do. The declared segment lift of 14 points could never appear because the control already improves at 89% and the simulation caps any cohort at 98%, so the page contradicted itself one line apart. And the retest window was part of the random seed, so waiting longer for a retest changed how many people had bought.

### The brand funnel implies a believable acquisition cost
- What: purchases per impression moved from 1.2% to 0.01%.
- Why: the old rate turned a $20,000 budget into 13,396 purchases of a $199 test, an implied acquisition cost of $1.49. A consumer-health founder stops listening at that number. The new rate implies about $180, which is the range the business actually lives in.

### The creator card predicts a specific root cause
- What: the card prompt now names the evidence for each segment and permits "mixed" only when no driver dominates.
- Why: six of six regenerated cards answered "mixed", which makes the prediction look like a stub. With the evidence spelled out the same ten creators come back as androgen, insulin, inflammation, cortisol and mixed, with fit scores from 5 to 98.

### One-shot completions re-sample an empty reply
- What: `GeminiProvider.complete` retries up to twice when the candidate comes back empty, matching what `streamTurn` already did.
- Why: card generation failed outright on an empty candidate. The streaming path had handled this since M4; the one-shot path had not, which is the kind of inconsistency that only shows up under load.

### The scripts load .env.local
- What: `migrate`, `seed`, `sweep`, `eval` and `discover` run under `node --env-file-if-exists=.env.local`.
- Why: the README tells a stranger to put their credentials in `.env.local`, and then every script ran bare `node` with no dotenv anywhere in the project, so steps three, four and six of the setup could not work for anyone but me. That is the M7 definition of done failing in the one place a reviewer will actually try.

### Smaller corrections from the same review
- The landing loop's labels were clipped by the viewBox: "Blueprint" overhung the right edge by 25 units and "Data" the left by 10, so the opening frame of the demo read "Bluep" and "ata". The viewBox is now padded by the label overhang.
- The model chart's legend painted itself surface-on-surface at 1:1 contrast, because the stacked areas use a surface-coloured stroke as the 2px gap between them and the default legend inherits that stroke. The legend now owns its colours.
- `CountUp` animated from the last settled value rather than the one on screen, so dragging a slider lagged behind the finger on the exact gesture the page caption advertises.
- The creator table rendered the 0-100 fit score as a percentage, so a score of 40 read "40%" next to a creator page saying "40 / 100".
- The proposals list is capped at thirty and now says so; after a sweep there are 336.
- The ticket summariser never saw the cause the sweep had already assigned, so the same screen could show two different causes. It now receives it and is told to agree unless the ticket text says otherwise.
- `settings.claude_model` said `claude-sonnet-5` while the app ran Gemini. The seed now writes whatever provider is configured, so the database cannot contradict the product.
- The architecture diagram used Mermaid's `[/label]` parallelogram syntax without closing it, so the one diagram in the docs rendered as a syntax error on GitHub. It also omitted `lib/attribution`, which computes the headline growth metric.
- There was no favicon, so every page logged a 404 in the console.

### The eval harness grades the call the answer was built from
- What: `answer_count_matches_rows` compares the answer's table against the last call of that tool that did not error, and fails outright if every call errored.
- Why: a run hit a transient Supabase error ("JWT issued at future") on the first `list_customers` call. The copilot did the right thing, retried, and answered from the 17 rows the retry returned; the harness compared the answer against the errored call and failed a correct answer. Grading the retry is stricter, not looser: an answer with a table and no successful call is now an explicit failure instead of an accident of null arithmetic.

### The rail is one list, and the persona follows the page
- What: the "Viewing as" switcher is gone. The rail is six pages in four groups named after the personas that own them (Support, Growth, Founder, Partner brand), always in the same order, and opening a page sets `?as=` to its group's persona. A footer line still says who you are viewing as.
- Why: the old rail had two lists that echoed each other (Growth appeared in both) and re-sorted the groups whenever the persona changed, so the same click landed in a different place each time. Steven could not use it and said so. Personas only re-skin copy and never change data access, so the cost of losing "view /ops as Founder" is nothing anyone would miss.
- Alternative: keep the switcher and stop the re-sort. Rejected because the duplication was half the confusion.
- Second pass, same complaint: three groups instead of four, with the partner brand portal under Growth (its link still views the app as the brand persona), bold titles that read as titles because they are not links, and page names that say what the page shows: Ad budget split, Customer insights, Valuation calculator, Partner brand portal. The page headlines were renamed to match, so the rail and the page never disagree.

## M9 — Every page rebuilt around the question it answers

Steven's review of the running product: the pages were tables with no stated purpose, the ops grid had no order, the copilot took a third of a page, the lists ran for hundreds of rows, and the content sat in the left two-thirds of the screen. This milestone is the response. The data model, the guard, the allocator and the copilot did not change; how they are shown did.

### The shell fills the screen and carries the copilot
- What: content runs to 1720px with the rail beside it; the copilot is a dock, a button in the bottom-right corner on every page that opens a side panel with the same chat and transparency panel.
- Why: the copilot is a way of asking the database a question, which is useful on every page, not a section of one. Putting it in the shell means the conversation survives navigation. The 1280px column from §14 left a third of a wide screen empty; the tables and charts on these pages use the width.
- Alternative: a chat page of its own. Rejected because the answer is about whatever you are looking at.

### Every page opens with six numbers and a purpose strip
- What: a KPI row of six headline numbers, then a "What this page is for" strip: the job in one sentence and the three things you do here.
- Why: a first-time viewer asked "why is this table here". The strip answers before the table is reached, and the six numbers are the ones a founder would ask for in the first minute. The KPI tile is one component so every page reads the same.

### Long lists page at 25 with the page number in the URL
- What: `lib/ui/paging.ts` and a `Pager` of links. Views are links too (`?view=tickets&page=2`), so a state can be shared and survives refresh.
- Why: 588 kits and 350 proposals in one scroll was unusable; client-side paging would have meant shipping every row to the browser. Server paging keeps the page a server component and the URL the only state.

### The kit lifecycle is a track, not a grid
- What: the eleven happy-path states in order under four phase headings, a bar per state scaled to the busiest, the stuck share in garnet, and the three exception states indented under the step they branch from.
- Why: the previous grid wrapped sixteen equal cards in whatever order the screen width produced. The order is the product; the exception states are branches, and drawing them as branches is what makes "results locked hangs off resulted" legible without a sentence.

### The allocator page states its value in retests
- What: expected retests from this split, against the same budget split by followers and split evenly, from each campaign's observed cost per order and posterior mean (`lib/allocator/compare.ts`); a 90% credible interval on every posterior (`betaInterval`, numeric integration of the density); a this-run-against-last chart; the posteriors as small multiples with the interval shaded.
- Why: "Thompson sampling" is a mechanism, not a reason. The reason is that the same $10,000 buys more retests when it follows retests than when it follows followers, and the page now says by how much.

### The brand portal is a funnel, an interval and the segment's real numbers
- What: a funnel chart with step conversions, an outcome chart with 95% whiskers on both arms, the segment's guarded marker deltas, and a table of every segment's size, share, retest rate and improvement rate from the guard.
- Why: a brand buying placement wants to know what the cohort looks like today, not only a simulated lift. Everything in that section is a guarded aggregate; the simulated part is labelled as such on every figure.

### Customer insights adds three datasets and a downloads table
- What: retest rate by signup month, improved-at-retest by segment, retest rate by segment, and the segment mix by age band as 100% stacked bars; a downloads table listing every dataset, its cells and how many are suppressed, each with a CSV link; the guardrails card beside it.
- Why: the three new cuts were the questions the old page could not answer (is retention improving over time, which root cause responds, which comes back). All go through the same guard and the same three-dimension cap.
- Palette: the six segment hues are the dataviz reference categorical slots, validated with the skill's script on both surfaces (dark 6/6 pass; light passes with three contrast warnings, which the direct labels and the table under the chart satisfy).

### The valuation calculator shows the thesis as a curve
- What: valuation at the horizon against retest rate from 10% to 90% for all three pricing models on one chart, valuation over time inside the 6× to 25× multiple band, a year-by-year table, and a formulas panel in place of two paragraphs of prose. `sensitivity()` and `yearSummary()` are pure and tested.
- Why: "drag the slider and watch the number" shows one point; the sensitivity chart shows the whole function, and that the membership-first curve is above the standalone curve at every retest rate is the argument for the pricing change in one picture.
