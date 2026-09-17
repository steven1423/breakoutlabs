# BreakoutOS

The internal operating system that closes the 90-day retest loop at BreakoutLabs: ops, growth and intelligence in one product, with a business model visible inside it.

- `CLAUDE.md` is the full specification and the source of truth.
- `docs/DECISIONS.md` records why each non-obvious choice was made.
- `docs/SCOPE.md` says what is Live, what is Seeded and what was cut.
- `docs/ARCHITECTURE.md` is the one-page shape of the system.

## Setup

Requires Node 22.18 or newer (the scripts use Node's built-in TypeScript support) and pnpm 10.

1. `pnpm install`
2. Copy `.env.example` to `.env.local` and fill in the values. The example lists names only.
3. `pnpm dev` and open http://localhost:3000

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
| `pnpm eval` | Runs the 15 copilot evals against the live database (needs the key for the configured `MODEL_PROVIDER`) |

`pnpm discover` is added by the milestone that builds it.

## Database

1. `pnpm migrate` applies `supabase/migrations/*.sql` in order and records them in `schema_migrations`.
2. `pnpm gen:types` writes the TypeScript types for the schema.
3. `pnpm seed` loads 500 synthetic customers and everything attached to them. Run it twice and the checksum must not change.

## Honesty labels

Every view carries a badge. Live means a real external API or real database logic in the production build. Seeded means synthetic data. No real customer data exists anywhere in this project.
