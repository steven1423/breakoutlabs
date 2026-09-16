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
