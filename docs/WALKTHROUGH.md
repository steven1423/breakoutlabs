# Walkthrough

A tour of this codebase for someone who has to defend it. `CLAUDE.md` says what was built and why the business needs it; `docs/DECISIONS.md` records every non-obvious choice with the alternative that was rejected. This file explains the four mechanisms worth understanding in depth, then lists the questions a reviewer is most likely to ask and what the honest answer is.

## The shape

A request carries a persona in the query string (`?as=support|growth|founder|brand`). The app shell reads it in the one client component that exists in the layout, because a server layout cannot see the query. Pages are server components; each one calls a module under `lib/` and renders. Personas re-skin navigation and copy and never change data access: there is exactly one read path per subsystem and the persona is not an argument to any of them.

```
app/(marketing)/page.tsx      the loop, the thesis, Enter
app/(app)/ops                 kits, the sweep, the copilot, tickets
app/(app)/growth              creators, the leaderboard, the allocator
app/(app)/intelligence        guarded aggregates
app/(app)/model               the calculator, no database at all
app/(app)/brand               the simulated partner portal
app/api/{copilot,aggregates,sweep,creators/*}
lib/{state-machine,copilot,creators,attribution,allocator,intelligence,brand,model,synthetic}
```

Everything under `lib/` uses relative imports, never the `@/` alias, so any module can be imported by a plain Node script. That is not a style preference: `pnpm seed`, `pnpm sweep`, `pnpm discover` and `pnpm eval` run on Node's own TypeScript support, and Node cannot resolve the alias. Only `app/` and `components/` use `@/`.

Writes are few and each one is named: the sweep, a staff fix on a kit, Confirm or Reject on a proposal, a cached ticket summary, creator upserts, an allocator run, and the minimum-cohort setting. Nothing in the product sends an email or an SMS. There is no such code to disable.

## 1. How the copilot is prevented from writing

This is the mechanism a CTO will probe first, so know it cold.

Three layers, and the interesting part is that only the third is load-bearing.

**Layer one, the tool surface.** `lib/copilot/tools.ts` defines ten tools, each with a zod schema. Nine run SQL we wrote. The tenth, `run_readonly_query`, is the only path where model-authored SQL reaches Postgres. `propose_action` is the only tool that writes, and it writes one row to `pending_actions` with status `proposed`. A human clicks Confirm; there is no code path from a model token to a side effect.

**Layer two, the guard.** `lib/copilot/guard.ts` is a pure whitelist over the SQL string: one statement, must begin with `select` or `with`, no semicolons, comments, locks, `into`, writes, settings, sleeps or file functions. A passing query is then planned with `explain` as the restricted role before it runs, which catches bad SQL and privilege errors without executing anything.

**Layer three, the Postgres role.** This is the one that matters. Migration 0005 creates schema `copilot` holding masked views (masked email only, ticket bodies truncated to 500 characters, no photo fields) and a `copilot` role with `select` on those views and nothing else. Migration 0006 exposes two functions, `copilot_run_readonly_query` and `copilot_explain_query`, as **security invoker** with `grant copilot to service_role`, and they `set local role copilot` before running the statement.

Why invoker and not definer, which is the obvious choice? Because Postgres forbids `SET ROLE` inside a security-definer function. Migration 0005 tried it and 0006 corrected it. Say that out loud if asked; a forward-only migration that fixes the previous one is a better answer than pretending the first attempt was right.

What was verified rather than assumed, against the live database: the role can read the views, `public.customers` is denied, an `explain` of an `update` is denied with "permission denied for view tickets", the 200-row cap holds, and `anon` cannot execute either function.

**The cap that was the wrong unit.** The wrapper bounded rows, and one aggregating select is one row. `select jsonb_agg(row_to_json(b)) from biomarker_results b` came back as 864 KB in a single row, which the loop pasted into the model's context and the transparency panel labelled "1 row". Migration 0009 adds a 128 KiB ceiling with the same check repeated in TypeScript, and the panel now prints the payload size. Two hundred legitimate rows measure about 15 KB, so nothing real touches the ceiling. Be straight about what is still true: a narrow aggregate returns 500 masked customers in 18 KB and passes, because no privilege boundary is being crossed — the role may read those rows 200 at a time anyway. The ceiling bounds cost and context; the masked views bound what can be read at all.

**The other limit you should volunteer.** The 5-second statement timeout is enforced by the client, not the database. `set_config('statement_timeout')` inside a running statement does not re-arm the timer, which was measured: a `pg_sleep(10)` through the function completed. So the real guarantee is an `AbortSignal.timeout(5000)` on the call plus the guard rejecting `pg_sleep`, with `alter role copilot set statement_timeout` covering any direct connection. Volunteering that is stronger than being caught by it.

**Prompt injection.** Ticket bodies and creator biographies are attacker-controlled in the real world and they flow into the model. The containment is structural rather than textual: the model's only write is a proposal, and a proposal needs a human click. A hostile ticket body can make the copilot say something wrong; it cannot make it do anything.

## 2. How the privacy guard works, and the hole that was in it

`lib/intelligence/guard.ts` is the single read path for every number on `/intelligence` and `/brand`. It filters to `consent_research`, groups by the requested dimensions, and replaces any cell with fewer than the minimum cohort by `{ suppressed: true }` with no count and no value.

Two subtleties are worth knowing because both were found by review, not by design.

**The minimum applies to the rows a measure is computed over, not to the cell.** A retest rate over 8 retested customers inside a cell of 30 is a statement about 8 people, so `contributors()` narrows to the rows the measure actually uses and the threshold is checked on those. Checking the raw cell size would let a rate over a handful of people through a large cell.

**Suppression alone is not anonymity.** A hostile review of this project requested all seven dimensions at once and received 209 suppressed cells for 209 consenting customers. Every cell was correctly marked suppressed, and the response was still a per-customer dump: each cell's dimension tuple was a unique quasi-identifier, and the cells came out in database order, which made the CSV a join key back to the customers table. One of those rows resolved to the demo customer by name.

The fix is `MAX_SPECIFICITY = 3`: a query may combine at most three grouping dimensions and filters, filters count toward the limit so a filter stack cannot do what the dimensions were stopped from doing, and cells are sorted by dimension value so the output order carries no information. Three covers every view: the map groups by one, retention by two, coverage by two plus a region filter. `tests/intelligence/` pins all of it, including that a 10,000 minimum cohort does not make the seven-dimension query safe.

If asked what else could leak: differencing two permitted queries is the next attack, and this implementation does not defend against it. Say so. The defence would be a query log with a privacy budget, which is a real system and out of scope for a seven-day submission.

## 3. The allocator, in maths a reviewer can check

`lib/allocator/thompson.ts`. One Beta posterior per active campaign over retest-per-order: `Beta(1 + retested, 1 + orders − retested)`, the uniform prior updated by what the campaign has actually shown. Each week, sample θ from every posterior, allocate budget in proportion to the samples, then clamp every share to a 5% floor and a 40% cap.

The clamp is the part with a bug in the obvious implementation. Clamping and renormalising can leave money unspent when several campaigns are pinned at a bound. This version water-fills: clamp, compute the shortfall, hand it to the campaigns that still have headroom in proportion to that headroom, repeat until nothing moves. The test that matters is the case that broke the first version: two campaigns at the cap and one at the floor.

Amounts are whole cents that sum to the budget exactly, with leftover cents going to the largest remainders. Tests assert the sum to the cent across five seeds, the floor and cap, that more observed retests move a posterior's mean up, and that 200 runs put more budget on the strong campaign than the weak one.

The run is seeded by ISO week, so pressing Run twice in one week reproduces the draw. That is deliberate and it looks like a bug if you do not say so on camera.

## 4. Why the synthetic data is trustworthy

`lib/synthetic/` is pure. One `Rng` seeded with `breakoutos-v1` drives customers, kits, events, panels, biomarkers, engagement, tickets and creators, in that order. Every id and every timestamp comes from that stream and "today" is a fixed constant, so the database defaults nothing and `pnpm seed` twice prints the same SHA-256 checksum. The tests assert the checksum, the distributions from §12, the segment driver rules, the exception mix, and that the two story creators on the leaderboard really do swap places when you change the ranking.

Distributions use exact quotas rather than repeated weighted draws, because at 500 customers a weighted draw missed the specified shares by two standard deviations often enough to fail its own test.

The 40 YouTube channels are real, captured once by `pnpm discover` and committed as a snapshot so the seed reproduces. They load as Seeded and only become Live when a running build re-fetches them. Every email address and phone number in a channel description is redacted on the way in, including inside the cached raw responses, and discovery drops anything under 1,000 subscribers so the set is partnership prospects rather than private individuals. All three of those were review findings: 20 real email addresses had reached the cache table, three phone numbers reached the committed snapshot, and 23 of the original 40 channels had under 1,000 subscribers while the docs claimed professional accounts.

## Questions to expect

**"Why Gemini when the job description says Claude?"** The provider is one environment variable. `lib/copilot/provider.ts` defines a neutral turn and `providers/anthropic.ts` and `providers/gemini.ts` translate to each vendor. The Anthropic path is the default in the code and unit-tested; the Anthropic account had no credits when the evals were due, so the demo runs on Gemini's free tier and the badge on `/ops` names whichever model answered. Nothing in the loop, the tools, the guard or the evals depends on the vendor.

**"How do you know the copilot is right?"** Fifteen eval cases in `evals/copilot.json`, run by `pnpm eval` against the live database, asserting the tools called, the arguments, and properties of the answer. They pass 15 of 15 on two consecutive runs. The first run was 13 of 15, and every failure traced to a missing fact rather than a bad model: the query tool never told the model the column names, the prompt said to decline every send, and no typed tool led from a kit code to a ticket id. Fixing the facts is the right response; loosening the assertions would have hidden it.

**"What is not real here?"** `docs/SCOPE.md` answers this per view. Short version: every customer, kit, panel, ticket and campaign is synthetic. The YouTube adapter is live. Instagram and search adapters are written and fixture-tested but never exercised, because there are no keys, and the pages say so rather than pretending. The brand portal is a simulation and says so on every number. There are no accounts; the personas are a switcher, which means every server action is reachable by anyone who can reach the page, and that is a stated scope decision rather than an oversight.

**"What would you do next?"** Accounts and row-level security for real staff, which is the only thing standing between this and a pilot. Then a privacy budget over the aggregate endpoint to close the differencing attack. Then Instagram enrichment, which is written and waiting for a token.

**"What broke?"** The honest list is the M8 section of `docs/DECISIONS.md`: a per-customer dump through a guarded endpoint, real email addresses in a cache table, phone numbers in a committed file, a hardcoded control rate presented as measured, a brand funnel implying a $1.49 acquisition cost, and two clipped words on the opening frame of the demo. All found by an adversarial review of the finished product, all fixed with tests. A reviewer trusts a project that records its own defects more than one that reports only successes.
