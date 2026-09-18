# Demo

The six beats of CLAUDE.md §17 as a shot list, with the values that are in the database right now. Every number below was read off the running production build, so if a number on screen disagrees with this file, the database has moved and you should reset it.

## Before you record

```
pnpm build && pnpm start          # the production build, not pnpm dev
```

The environment needs `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `YOUTUBE_API_KEY`, `MODEL_PROVIDER=gemini` and `GEMINI_API_KEY`. Without a model key the copilot and the creator cards disable themselves with a message, which is honest but costs you two beats.

To reset to the state this file describes:

```
pnpm seed                 # 500 customers, deterministic; prints a checksum
pnpm sweep                # classifies stuck kits, opens tickets, proposes nudges
```

Then regenerate the AI cards and two allocator runs, because `pnpm seed` clears them. The commands are in the walkthrough. Leave the minimum cohort at 10.

Current state: 61 open tickets, 336 proposed nudges, 10 creator cards, 209 of 500 customers consenting to research, and 0 of 70 creators marked Live until you press Discover in beat 3.

## Beat 1 — the landing page, 20 seconds

Open `/`. Do nothing for six seconds. The loop draws itself arc by arc, the six stage labels appear, then the three thesis lines, then the button.

Say: the asset is not the test, it is the retest. Every leak in the loop is data that never existed.

Click **Enter BreakoutOS**. It lands on `/ops` as the Support persona.

## Beat 2 — ops and the copilot, 90 seconds

On `/ops`, six headline numbers, then the lifecycle track: eleven steps from order to retest, a bar per step, garnet where kits are past their SLA, and the three exception states hanging under the step they branch from. Point at **Results locked**, 16 kits, all stuck.

Click kit **BL-4471-XK** in the stuck queue. It is in Results locked, 115 hours in state, 91 hours past the 24 hour SLA, and the timer is live. Its ticket is "Kit ID invalid", classified by the sweep as portal lockout.

Say: this is the state that produces one-star reviews. Results exist and the customer cannot reach them. Nobody filed this, the sweep found it.

Back on `/ops`, use the **Ask the copilot** panel under the four phases: click the first example chip, or open the dock from the bottom-right corner on any page. The panel slides in from the right and follows you between pages. Ask:

> customers whose results are ready but haven't logged in for 7 days

Open the transparency panel underneath the answer. It lists every tool call, its arguments, the rows returned and the milliseconds taken.

Then ask it something it must refuse:

> delete the ticket from Marissa

It declines, says it is read-only, and offers to propose an action instead.

Say: it reads through ten typed tools and one guarded SQL path, as a Postgres role that can only see masked views. It cannot write. The only write in the whole agent is a proposal a human confirms.

Close the panel. In the **Work queue**, switch to **Proposed actions** and click **Confirm nudge** on one. The row records the decision. Nothing is sent: there is no send in this system. The queue pages 25 at a time; **Stuck kits**, **Open tickets** and **All kits** are the other views.

## Beat 3 — growth, 90 seconds

On `/growth`, open the **All creators** tab and press **Discover on YouTube**. It runs the seven discovery queries, enriches what it finds, drops everything under 1,000 subscribers, and flips those rows to Live with the badge. It reports how many it dropped and how much quota is left.

Say: discovery is a commodity. Every row says which adapter produced it and whether its numbers are live.

Now the **Campaign leaderboard** tab. The callout above it already states the story; the table proves it. Ranked by followers, **tayglowsup** is first: 430,000 followers, and $1,933 per retest on 3 retests from 40 orders. Click **Rank by cost-per-retest**. The rows animate and **hannah.hormonehealth** takes first place: 61,000 followers, $175 per retest on 8 retests from 14 orders.

Say: the same fourteen orders look small until you price them by the thing that compounds. This is the metric the business runs on and nobody else in acne can compute it.

Open hannah.hormonehealth's creator page: six numbers, then the AI card with the campaign results inside it: fit 98 on the current cards (it moves a few points each time they are regenerated), androgen, a price band labelled estimate, and an outreach draft under 120 words.

Then **Ad budget split** under Growth (`/growth/allocator`). The latest run puts $846.58 on hannah and the $500 floor on tayglowsup out of $10,000 across 15 campaigns. Each campaign shows its Beta posterior as a density curve with the sampled draw marked.

Say: Thompson sampling over retest-per-order, with a 5% exploration floor and a 40% cap.

## Beat 4 — intelligence, 90 seconds

Open **Customer insights** under Founder in the rail (`/intelligence`). 209 of 500 customers consented; only they are counted anywhere on this page. At a minimum cohort of 10, six states show a leading segment and 31 are hatched as insufficient data.

Say: we rent access to segments and we never sell data. The setting on the right is why, and it is code, not copy.

In the guardrails panel, change the minimum cohort to 20 and save. Cells disappear. Change it back to 10 and they return.

Click one of the **Export aggregates** links. The CSV contains dimension values, counts and values; suppressed cells print the word suppressed. Point at the **Export rows** control, which is disabled and says row-level export does not exist in this system.

If someone asks whether the API can be talked into returning rows: it cannot group or filter on more than three dimensions at once, because a deep enough grouping identifies people even when every cell is suppressed. That limit exists because a review of this project found exactly that hole and it is now closed with tests.

## Beat 5 — the brand portal, 60 seconds

Open **Partner brand portal** under Growth (`/brand`). Pick **insulin**, **25-34**, a $20,000 budget, a 90-day window.

The funnel reads about 1.1 million impressions, 111 purchases, 91 registrations, 58 retests, and roughly $345 per retest. The control cohort line says the segment cell is below the minimum of 10, so the guarded all-segment rate of 89% measured on 37 customers stands in.

Read the line under the outcome panel out loud. It states the expected lift, the observed lift, a 95% interval, and then says that 58 retests against a control of 37 cannot resolve an effect this size.

Say: this is what a partner brand would buy in Year 3, and the portal refuses to oversell it. That interval is the argument for volume of retests, which is the same argument as the whole product.

If you raised the minimum cohort to 50 earlier and forgot to lower it, this page says no control cohort survives the threshold and stops rather than inventing a number. That is also a fine thing to show on purpose.

## Beat 6 — the model, 60 seconds

Open **Valuation calculator** under Founder (`/model`). Choose **Membership first**. Drag the retest rate from 30% to 60%. The implied valuation moves from about $279M to about $343M and the tiles count to their new values.

Say: price for the retest. The slider is the thesis as arithmetic.

Scroll to the timeline. Year 1 links to ops and growth, Year 2 to this page with membership-first preset and to intelligence, Year 3 to the brand portal. Click one to land where the milestone is built.

Point at the footnote naming the three assumptions this model adds to the specification, including that members who retest do not churn.

## If something goes wrong on camera

- The copilot is slow or empty: it retries rate limits and empty replies on its own. Wait; the transparency panel fills in as calls complete.
- Discover reports quota exhausted: the cached responses still serve, and the page says so. 60 search calls per day is the cap.
- A page shows an error panel: it names the failure. Check `SUPABASE_SERVICE_ROLE_KEY`.
- A number here disagrees with the screen: run `pnpm seed` then `pnpm sweep` and regenerate the cards.
