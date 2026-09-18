# BreakoutOS

The internal operating system that closes the 90-day retest loop at BreakoutLabs: ops, growth and intelligence in one product, with a business model visible inside it.

- `CLAUDE.md` is the full specification and the source of truth.
- `docs/DECISIONS.md` records why each non-obvious choice was made.
- `docs/SCOPE.md` says what is Live, what is Seeded and what was cut.
- `docs/ARCHITECTURE.md` is the one-page shape of the system.

## Setup in 15 minutes

Requires Node 22.18 or newer (the scripts use Node's built-in TypeScript support) and pnpm 10. You need a Supabase project (free tier is fine), and optionally a YouTube Data API key and a Gemini or Anthropic key.

1. `pnpm install` (about a minute).
2. Copy `.env.example` to `.env.local`. Fill in:
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (the publishable key) and `SUPABASE_SERVICE_ROLE_KEY` (the secret key) from your project's API settings.
   - `SUPABASE_ACCESS_TOKEN` (a personal access token) and `SUPABASE_PROJECT_REF`, used only by `pnpm migrate` and `pnpm gen:types`.
   - Optional: `YOUTUBE_API_KEY` turns the growth page's YouTube adapter Live. `MODEL_PROVIDER=gemini` with `GEMINI_API_KEY`, or `ANTHROPIC_API_KEY`, turns the copilot and creator cards on. Without them the pages say "Not configured" and stay Seeded.
3. `pnpm migrate` applies the eight SQL migrations over HTTPS (about 30 seconds).
4. `pnpm seed` loads 500 synthetic customers and everything attached to them, then prints row counts and a checksum. Run it twice: the checksum must not change.
5. `pnpm dev` and open http://localhost:3000. Press Enter BreakoutOS; `/ops` should list kits with `BL-4471-XK` in Results locked.
6. Optional: `pnpm sweep` opens tickets for stuck kits; `pnpm discover` pulls 40 YouTube channels (needs the key); `pnpm eval` runs the copilot evals (needs a model key).
7. Optional, for the skin scan: unzip the SkinLoop `acne-model` bundle to `./vendor/acne-model` and run `pnpm models`. It copies the 11 MB lesion detector and the 14 MB onnxruntime wasm runtime under `public/`; neither is committed. Without it the scan page loads the face bundle and then says the detector is not installed.

What each page needs: `/ops`, `/intelligence`, `/brand` and `/model` work with Supabase alone. `/growth` shows seeded creators without the YouTube key and live ones with it. The copilot and creator cards need a model key.

## Commands

| Command | What it does |
|---|---|
| `pnpm dev` | Runs the app locally |
| `pnpm build` | Production build, including the type check |
| `pnpm start` | Serves the production build |
| `pnpm test` | Runs the Vitest suite once |
| `pnpm typecheck` | TypeScript strict check |
| `pnpm lint` | ESLint with Next's rules |
| `pnpm migrate` | Applies unapplied SQL migrations over HTTPS (needs the access token and project ref) |
| `pnpm gen:types` | Regenerates `lib/db/types.ts` from the live schema |
| `pnpm seed` | Wipes and reloads the synthetic dataset; prints counts and a checksum |
| `pnpm sweep` | Runs the stuck-kit sweep once; safe to repeat |
| `pnpm discover` | Runs YouTube discovery once (needs YOUTUBE_API_KEY), upserts the creators as Live and rewrites the seed snapshot |
| `pnpm eval` | Runs the 15 copilot evals against the live database (needs the key for the configured `MODEL_PROVIDER`) |
| `pnpm models` | Copies the skin scan's wasm runtime from node_modules and the lesion detector from `./vendor/acne-model` (or `MODEL_DIR`, `MODEL_URL`) into `public/` |

## Database

1. `pnpm migrate` applies `supabase/migrations/*.sql` in order and records them in `schema_migrations`.
2. `pnpm gen:types` writes the TypeScript types for the schema.
3. `pnpm seed` loads 500 synthetic customers and everything attached to them. Run it twice and the checksum must not change.

## Checks before a merge

`pnpm typecheck`, `pnpm lint`, `pnpm test` and `pnpm build` must all pass. For the accessibility bar, run `pnpm dlx lighthouse http://localhost:3000/ops --only-categories=accessibility --chrome-flags="--headless"` against `pnpm start`.

## Honesty labels

Every view carries a badge. Live means a real external API or real database logic in the production build. Seeded means synthetic data. No real customer data exists anywhere in this project.
