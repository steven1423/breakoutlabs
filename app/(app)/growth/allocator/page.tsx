import type { Metadata } from "next";
import { BetaCurve } from "@/components/beta-curve";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { RunAllocator } from "@/components/run-allocator";
import { loadAllocatorView, type AllocatorView } from "@/lib/allocator/db";
import { posteriorMean } from "@/lib/allocator/thompson";
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
  return (
    <>
      <PageHeader title="Ad budget split" caption={CAPTION} status="seeded" reason="Synthetic attribution, real sampling" />
      <section className="mt-8">
        <RunAllocator defaultBudget={latest?.budgetUsd ?? 10_000} />
      </section>
      {!latest ? (
        <EmptyState title="No allocator runs yet" body="Enter a weekly budget and press Run allocator. The posterior for each campaign is Beta(1 + retested, 1 + orders − retested)." />
      ) : (
        <section className="mt-8">
          <p className="text-15 text-muted">
            Latest run {latest.runAt.slice(0, 16).replace("T", " ")} UTC, budget {formatUsd(latest.budgetUsd)}.
            {previous ? ` Compared with the run before it (${previous.runAt.slice(0, 10)}).` : " No earlier run to compare with."}
          </p>
          <div className="mt-4 overflow-auto rounded-panel border border-line">
            <table className="w-full text-15">
              <thead className="sticky top-0 bg-surface text-left text-13 text-muted">
                <tr>
                  <Th>Campaign</Th>
                  <Th>Posterior</Th>
                  <Th right>Mean</Th>
                  <Th right>Sampled</Th>
                  <Th right>This run</Th>
                  <Th right>Last run</Th>
                  <Th right>Change</Th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(latest.allocation)
                  .sort((a, b) => b[1] - a[1])
                  .map(([id, usd]) => {
                    const p = latest.posterior[id];
                    const before = previous?.allocation[id];
                    const change = before === undefined ? null : usd - before;
                    return (
                      <tr key={id} className="border-t border-line">
                        <td className="px-4 py-2">
                          {campaigns[id]?.handle ?? id}
                          <span className="ml-2 text-13 text-muted">{campaigns[id]?.code ?? ""}, Beta({p.alpha}, {p.beta})</span>
                        </td>
                        <td className="px-4 py-2"><BetaCurve posterior={p} /></td>
                        <td className="px-4 py-2 text-right">{(posteriorMean(p) * 100).toFixed(0)}%</td>
                        <td className="px-4 py-2 text-right text-accent">{(p.sampled * 100).toFixed(0)}%</td>
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
      )}
    </>
  );
}

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return <th scope="col" className={`px-4 py-2 font-medium ${right ? "text-right" : ""}`}>{children}</th>;
}
