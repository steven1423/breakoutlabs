import type { Metadata } from "next";
import { AllocationChart } from "@/components/allocation-chart";
import { EmptyState } from "@/components/empty-state";
import { KpiRow } from "@/components/kpi";
import { PageHeader } from "@/components/page-header";
import { PosteriorGrid, type PosteriorCard } from "@/components/posterior-grid";
import { RunAllocator } from "@/components/run-allocator";
import { WhyThisPage } from "@/components/why";
import { expectedRetests, splitByFollowers, splitEven, type CampaignFacts } from "@/lib/allocator/compare";
import { loadAllocatorView, type AllocatorView } from "@/lib/allocator/db";
import { betaInterval, CAP, FLOOR, posteriorMean } from "@/lib/allocator/thompson";
import { formatUsd } from "@/lib/growth/queries";

export const metadata: Metadata = { title: "Ad budget split" };
export const dynamic = "force-dynamic";

const CAPTION = "Budget follows retests, not followers. One Beta posterior per campaign; sample, allocate, floor 5%, cap 40%.";

export default async function AllocatorPage() {
  let view: AllocatorView | null = null;
  let failure: string | null = null;
  try {
    view = await loadAllocatorView();
  } catch (err) {
    failure = err instanceof Error ? err.message : "Unknown error";
  }
  if (!view) {
    return (
      <>
        <PageHeader title="Ad budget split" caption={CAPTION} status="seeded" reason="Database unavailable" />
        <EmptyState title="Could not load runs" body={`The database query failed: ${failure}. Check the Supabase env vars and try again.`} />
      </>
    );
  }

  const { latest, previous, campaigns } = view;
  const facts: CampaignFacts[] = Object.entries(campaigns).map(([campaignId, c]) => ({ campaignId, orders: c.orders, retested: c.retested, spend: c.spend, followers: c.followers }));

  return (
    <>
      <PageHeader title="Ad budget split" caption={CAPTION} status="seeded" reason="Synthetic attribution, real sampling" />

      <WhyThisPage
        job="Decide next week's creator budget from what each campaign has actually produced, while still giving unproven campaigns a chance."
        steps={[
          { title: "Believe, with uncertainty", body: "Each campaign's retest-per-order is a Beta distribution: its orders and retests so far, starting from a flat prior." },
          { title: "Sample, then allocate", body: "Draw one value from every distribution and split the budget in proportion. Unproven campaigns sometimes draw high; that is the exploration." },
          { title: "Floor and cap", body: `No campaign gets under ${FLOOR * 100}% or over ${CAP * 100}%, so nothing starves and nothing monopolises. The run is seeded by ISO week and reproducible.` },
        ]}
      />

      <section className="mt-6 rounded-panel border border-line bg-surface p-5">
        <RunAllocator defaultBudget={latest?.budgetUsd ?? 10_000} />
        <p className="mt-4 border-t border-line pt-3 text-13 text-muted">
          Where the numbers come from. Spend is what was paid to each creator for the partnership (seeded here; in production the fee on the contract). Orders, registrations and retests are BreakoutLabs&apos; own records, joined to the creator by the referral code the customer used at checkout, so nothing is pulled from an ad platform: creator partnerships are not paid ads, and the retest only exists in this database. Follower counts come from the platform APIs where an adapter is live (YouTube today). Nothing here is estimated by a model; the only model is the Beta posterior over the observed retests.
        </p>
      </section>

      {!latest ? (
        <EmptyState title="No allocator runs yet" body="Enter a weekly budget and press Run allocator. The posterior for each campaign is Beta(1 + retested, 1 + orders − retested)." />
      ) : (
        <LatestRun latest={latest} previous={previous} campaigns={campaigns} facts={facts} />
      )}
    </>
  );
}

function LatestRun({ latest, previous, campaigns, facts }: { latest: NonNullable<AllocatorView["latest"]>; previous: AllocatorView["previous"]; campaigns: AllocatorView["campaigns"]; facts: CampaignFacts[] }) {
  const ids = Object.keys(latest.allocation).sort((a, b) => latest.allocation[b] - latest.allocation[a]);
  const budget = latest.budgetUsd;
  const thisRun = expectedRetests(latest.allocation, facts);
  const even = expectedRetests(splitEven(budget, facts), facts);
  const byFollowers = expectedRetests(splitByFollowers(budget, facts), facts);
  const top = ids[0];
  const topShare = latest.allocation[top] / budget;
  const moved = previous ? ids.reduce((a, id) => a + Math.abs(latest.allocation[id] - (previous.allocation[id] ?? 0)), 0) / 2 : null;
  const atFloor = ids.filter((id) => Math.abs(latest.allocation[id] / budget - FLOOR) < 0.002).length;
  const atCap = ids.filter((id) => Math.abs(latest.allocation[id] / budget - CAP) < 0.002).length;

  const cards: PosteriorCard[] = ids.map((id) => ({
    id,
    handle: campaigns[id]?.handle ?? id,
    platform: campaigns[id]?.platform ?? "",
    posterior: latest.posterior[id],
    allocation: latest.allocation[id],
    share: latest.allocation[id] / budget,
    orders: campaigns[id]?.orders ?? 0,
    retested: campaigns[id]?.retested ?? 0,
  }));

  return (
    <>
      <KpiRow
        items={[
          { label: "Weekly budget", value: formatUsd(budget), detail: `Run ${latest.runAt.slice(0, 10)}, ${ids.length} campaigns` },
          { label: "Expected retests, this split", value: thisRun.toFixed(1), detail: "From each campaign's cost per order and posterior mean", tone: "live" },
          { label: "If split by followers", value: byFollowers.toFixed(1), detail: `${thisRun > byFollowers ? "+" : ""}${(((thisRun - byFollowers) / Math.max(byFollowers, 1e-9)) * 100).toFixed(0)}% versus paying the biggest audiences`, tone: "accent" },
          { label: "If split evenly", value: even.toFixed(1), detail: `${thisRun > even ? "+" : ""}${(((thisRun - even) / Math.max(even, 1e-9)) * 100).toFixed(0)}% versus a flat split` },
          { label: "Largest share", value: `${Math.round(topShare * 100)}%`, detail: `${campaigns[top]?.handle ?? top}; ${atCap} at the cap, ${atFloor} at the floor` },
          { label: "Money moved since last run", value: moved === null ? "–" : formatUsd(moved), detail: previous ? `Compared with ${previous.runAt.slice(0, 10)}` : "No earlier run to compare with" },
        ]}
      />

      <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <figure className="rounded-panel border border-line bg-surface p-5">
          <figcaption className="text-18">This run against the last</figcaption>
          <p className="mb-3 text-13 text-muted">Dollars per campaign, largest first. Coloured is this run; grey is the run before it.</p>
          <AllocationChart rows={ids.map((id) => ({ handle: campaigns[id]?.handle ?? id, thisRun: latest.allocation[id], lastRun: previous?.allocation[id] ?? null }))} />
          <ul className="mt-2 flex gap-4 text-13 text-muted">
            <li><span aria-hidden="true" className="mr-1.5 inline-block h-2.5 w-2.5 rounded-sm align-middle" style={{ background: "var(--chart-kits)" }} />This run</li>
            <li><span aria-hidden="true" className="mr-1.5 inline-block h-2.5 w-2.5 rounded-sm align-middle bg-muted opacity-50" />Last run</li>
          </ul>
        </figure>

        <section className="rounded-panel border border-line bg-surface p-5">
          <h2 className="text-18">What the allocator believes about each campaign</h2>
          <p className="mb-4 text-13 text-muted">
            Retest-per-order as a distribution. Shaded is the 90% credible interval, the dark tick is the mean, the garnet line is this week&apos;s draw. A wide curve is a campaign the system is still learning about.
          </p>
          <PosteriorGrid cards={cards} />
        </section>
      </div>

      <section className="mt-8 overflow-hidden rounded-panel border border-line">
        <div className="overflow-auto">
          <table className="w-full text-15">
            <thead className="sticky top-0 bg-surface text-left text-13 text-muted">
              <tr>
                <Th>Campaign</Th>
                <Th right>Orders</Th>
                <Th right>Retested</Th>
                <Th right>Cost per order</Th>
                <Th>Posterior</Th>
                <Th right>Mean</Th>
                <Th right>90% interval</Th>
                <Th right>Draw</Th>
                <Th right>Share</Th>
                <Th right>This run</Th>
                <Th right>Last run</Th>
                <Th right>Change</Th>
              </tr>
            </thead>
            <tbody>
              {ids.map((id) => {
                const p = latest.posterior[id];
                const c = campaigns[id];
                const before = previous?.allocation[id];
                const usd = latest.allocation[id];
                const change = before === undefined ? null : usd - before;
                const [lo, hi] = betaInterval(p);
                return (
                  <tr key={id} className="border-t border-line">
                    <td className="px-4 py-2">{c?.handle ?? id}<span className="ml-2 text-13 text-muted">{c?.code ?? ""}</span></td>
                    <td className="px-4 py-2 text-right">{c?.orders ?? 0}</td>
                    <td className="px-4 py-2 text-right">{c?.retested ?? 0}</td>
                    <td className="px-4 py-2 text-right">{c && c.orders > 0 ? formatUsd(c.spend / c.orders) : "–"}</td>
                    <td className="px-4 py-2 text-muted">Beta({p.alpha}, {p.beta})</td>
                    <td className="px-4 py-2 text-right">{(posteriorMean(p) * 100).toFixed(0)}%</td>
                    <td className="px-4 py-2 text-right text-muted">{(lo * 100).toFixed(0)} to {(hi * 100).toFixed(0)}%</td>
                    <td className="px-4 py-2 text-right text-accent">{(p.sampled * 100).toFixed(0)}%</td>
                    <td className="px-4 py-2 text-right">{((usd / budget) * 100).toFixed(1)}%</td>
                    <td className="px-4 py-2 text-right">{formatUsd(usd, 2)}</td>
                    <td className="px-4 py-2 text-right text-muted">{before === undefined ? "–" : formatUsd(before, 2)}</td>
                    <td className={`px-4 py-2 text-right ${change === null ? "text-muted" : change >= 0 ? "text-live" : "text-accent"}`}>
                      {change === null ? "–" : `${change >= 0 ? "+" : "−"}${formatUsd(Math.abs(change), 2)}`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return <th scope="col" className={`px-4 py-2 font-medium ${right ? "text-right" : ""}`}>{children}</th>;
}
