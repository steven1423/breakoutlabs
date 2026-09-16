# BreakoutOS

The internal operating system that closes the 90-day retest loop at BreakoutLabs: ops, growth and intelligence in one product, with a business model visible inside it.

- `CLAUDE.md` is the full specification and the source of truth.
- `docs/DECISIONS.md` records why each non-obvious choice was made.
- `docs/SCOPE.md` says what is Live, what is Seeded and what was cut.
- `docs/ARCHITECTURE.md` is the one-page shape of the system.

## Setup

Requires Node 20 or newer and pnpm 10.

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

`pnpm seed`, `pnpm eval`, `pnpm discover` and `pnpm sweep` are added by the milestones that build them.

## Honesty labels

Every view carries a badge. Live means a real external API or real database logic in the production build. Seeded means synthetic data. No real customer data exists anywhere in this project.
