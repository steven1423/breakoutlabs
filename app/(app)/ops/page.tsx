import type { Metadata } from "next";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { EXCEPTION_STATES, hoursInState, listKits, type KitList, type KitState } from "@/lib/ops/queries";

export const metadata: Metadata = { title: "Ops" };
export const dynamic = "force-dynamic";

const CAPTION = "Every one-star review is a missing state transition. This is where they get caught.";

export default async function OpsPage() {
  let kits: KitList | null = null;
  let failure: string | null = null;
  try {
    kits = await listKits();
  } catch (err) {
    failure = err instanceof Error ? err.message : "Unknown error";
  }

  if (!kits) {
    return (
      <>
        <PageHeader title="Ops" caption={CAPTION} status="seeded" reason="Database unavailable" />
        <EmptyState title="Could not load kits" body={`The database query failed: ${failure}. Check the Supabase env vars and try again.`} />
      </>
    );
  }

  return (
    <>
      <PageHeader title="Ops" caption={CAPTION} status="seeded" reason="Synthetic customers, live queries" />
      <StateSummary counts={kits.countsByState} total={kits.total} />
      <KitTable kits={kits} />
    </>
  );
}

function StateSummary({ counts, total }: { counts: KitList["countsByState"]; total: number }) {
  const entries = (Object.entries(counts) as [KitState, number][]).sort((a, b) => b[1] - a[1]);
  return (
    <section aria-label="Kits by state" className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-15">
      <span>
        <span className="text-muted">All kits </span>
        {total}
      </span>
      {entries.map(([state, count]) => (
        <span key={state}>
          <span className={EXCEPTION_STATES.has(state) ? "text-accent" : "text-muted"}>{humanise(state)} </span>
          {count}
        </span>
      ))}
    </section>
  );
}

function KitTable({ kits }: { kits: KitList }) {
  if (kits.rows.length === 0) {
    return <EmptyState title="No kits yet" body="Run pnpm seed to load the synthetic dataset." />;
  }
  return (
    <div className="mt-6 overflow-auto rounded-panel border border-line">
      <table className="w-full text-15">
        <thead className="sticky top-0 bg-surface text-left text-13 text-muted">
          <tr>
            <th className="px-4 py-2 font-medium">Kit</th>
            <th className="px-4 py-2 font-medium">Customer</th>
            <th className="px-4 py-2 font-medium">Plan</th>
            <th className="px-4 py-2 font-medium">State</th>
            <th className="px-4 py-2 text-right font-medium">Hours in state</th>
          </tr>
        </thead>
        <tbody>
          {kits.rows.map((row) => (
            <tr key={row.id} className="border-t border-line">
              <td className="px-4 py-2">
                {row.kit_code}
                {row.sequence_no > 1 ? <span className="ml-2 text-13 text-muted">retest</span> : null}
              </td>
              <td className="px-4 py-2">{row.customer?.first_name ?? "Unknown"}</td>
              <td className="px-4 py-2 text-muted">{humanise(row.customer?.plan ?? "")}</td>
              <td className={`px-4 py-2 ${EXCEPTION_STATES.has(row.state) ? "text-accent" : ""}`}>{humanise(row.state)}</td>
              <td className="px-4 py-2 text-right">{hoursInState(row.state_entered_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function humanise(value: string): string {
  const spaced = value.replace(/_/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}
