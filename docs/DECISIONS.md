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
