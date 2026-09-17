import type { Metadata } from "next";
import { CoverageHeatmap } from "@/components/coverage-heatmap";
import { EmptyState } from "@/components/empty-state";
import { Guardrails } from "@/components/guardrails";
import { MarkerDeltaCharts, type DeltaSeries } from "@/components/marker-delta-chart";
import { PageHeader } from "@/components/page-header";
import { StateGrid } from "@/components/state-grid";
import { openIntelligence, type Intelligence } from "@/lib/intelligence";
import { INTERVENTION_TYPES, MARKERS, type Cell } from "@/lib/intelligence/guard";
import { parsePersona } from "@/lib/personas";

export const metadata: Metadata = { title: "Intelligence" };
export const dynamic = "force-dynamic";

const CAPTION = "We rent access to segments. We never sell data. The setting on the right is why.";
const CHANNELS = ["instagram", "tiktok", "youtube", "search", "referral", "direct"];
const PLANS = ["standalone", "membership_first", "study"];

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function IntelligencePage({ searchParams }: Props) {
  const params = await searchParams;
  const persona = parsePersona(params.as);
  const region = typeof params.region === "string" && /^[A-Za-z]{2}$/.test(params.region) ? params.region.toUpperCase() : null;

  let intel: Intelligence | null = null;
  let failure: string | null = null;
  try {
    intel = await openIntelligence();
  } catch (err) {
    failure = err instanceof Error ? err.message : "Unknown error";
  }
  if (!intel) {
    return (
      <>
        <PageHeader title="Intelligence" caption={CAPTION} status="seeded" reason="Database unavailable" />
        <EmptyState title="Could not load aggregates" body={`The database query failed: ${failure}. Check the Supabase env vars and try again.`} />
      </>
    );
  }

  const map = intel.aggregate({ dimensions: ["region_state"], measure: "leading_segment" });
  const retention = intel.aggregate({ dimensions: ["channel", "plan"], measure: "retest_rate" });
  const coverage = intel.aggregate({ dimensions: ["segment", "age_band"], measure: "count", filter: region ? { region_state: region } : undefined });
  const deltas: DeltaSeries[] = INTERVENTION_TYPES.map((intervention) => ({
    intervention,
    points: MARKERS.map((marker) => {
      const cell = intel!.aggregate({ dimensions: [], measure: "marker_delta", marker, filter: { interventionType: intervention } }).cells[0];
      return { marker, delta: cell && !cell.suppressed ? cell.value : null, n: cell && !cell.suppressed ? cell.count : null };
    }),
  })).filter((s) => s.points.some((p) => p.delta !== null) || s.intervention !== "rx");
  const suppressedStates = map.cells.filter((c) => c.suppressed).length;

  return (
    <>
      <PageHeader title="Intelligence" caption={CAPTION} status="seeded" reason="Synthetic customers, real guard: every number passed the minimum-cohort check" />
      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(16rem,1fr)]">
        <div className="flex flex-col gap-10">
          <section>
            <h2 className="text-24">Prevalence by state</h2>
            <p className="text-15 text-muted">Leading root-cause segment among consenting customers. {map.cells.length - suppressedStates} states shown, {suppressedStates} suppressed at a minimum cohort of {intel.minCohort}.</p>
            <StateGrid cells={map.cells} />
          </section>

          <section>
            <h2 className="text-24">Intervention to marker delta</h2>
            <p className="text-15 text-muted">Customers with a baseline and a retest, grouped by the kind of intervention on their blueprint. Positive is toward optimal.</p>
            <MarkerDeltaCharts series={deltas} />
          </section>

          <section>
            <h2 className="text-24">Retention by channel and plan</h2>
            <p className="text-15 text-muted">Retest rate: share of consenting customers with a completed retest panel.</p>
            <RetentionTable cells={retention.cells} />
          </section>

          <section>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 className="text-24">Coverage</h2>
                <p className="text-15 text-muted">Consenting customers per segment and age band. Thin cells are where study-tier recruitment and creator seeding should go.</p>
              </div>
              <form method="get" className="flex items-center gap-2 text-15">
                <input type="hidden" name="as" value={persona} />
                <label htmlFor="region" className="text-13 text-muted">State</label>
                <select id="region" name="region" defaultValue={region ?? ""} className="rounded-control border border-line bg-surface px-2 py-1 text-15 text-text">
                  <option value="">All</option>
                  {map.cells.map((c) => c.dims.region_state).sort().map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                <button type="submit" className="rounded-control border border-line px-3 py-1">Filter</button>
              </form>
            </div>
            <CoverageHeatmap cells={coverage.cells} region={region} />
          </section>
        </div>

        <Guardrails
          consentRate={intel.total ? intel.consented / intel.total : 0}
          consented={intel.consented}
          total={intel.total}
          minCohort={intel.minCohort}
          exports={[
            { label: "Export aggregates (CSV): prevalence", href: "/api/aggregates?dims=region_state&measure=leading_segment&format=csv" },
            { label: "Export aggregates (CSV): coverage", href: "/api/aggregates?dims=segment,age_band&measure=count&format=csv" },
            { label: "Export aggregates (CSV): retention", href: "/api/aggregates?dims=channel,plan&measure=retest_rate&format=csv" },
          ]}
        />
      </div>
    </>
  );
}

function RetentionTable({ cells }: { cells: Cell[] }) {
  const byKey = new Map(cells.map((c) => [`${c.dims.channel}|${c.dims.plan}`, c]));
  return (
    <div className="mt-4 overflow-auto rounded-panel border border-line">
      <table className="w-full text-15">
        <thead className="bg-surface text-left text-13 text-muted">
          <tr>
            <th className="px-3 py-2 font-medium">Channel</th>
            {PLANS.map((p) => <th key={p} className="px-3 py-2 text-right font-medium">{p.replace("_", " ")}</th>)}
          </tr>
        </thead>
        <tbody>
          {CHANNELS.map((ch) => (
            <tr key={ch} className="border-t border-line">
              <td className="px-3 py-2">{ch}</td>
              {PLANS.map((p) => {
                const cell = byKey.get(`${ch}|${p}`);
                if (!cell) return <td key={p} className="px-3 py-2 text-right text-muted opacity-50">–</td>;
                if (cell.suppressed) return <td key={p} className="hatched px-3 py-2 text-right text-muted" title="Below the minimum cohort">n/a</td>;
                return <td key={p} className="px-3 py-2 text-right">{Math.round((cell.value ?? 0) * 100)}% <span className="text-13 text-muted">n {cell.count}</span></td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
