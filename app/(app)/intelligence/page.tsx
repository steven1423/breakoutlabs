import type { Metadata } from "next";
import { CoverageHeatmap } from "@/components/coverage-heatmap";
import { EmptyState } from "@/components/empty-state";
import { Guardrails } from "@/components/guardrails";
import { KpiRow } from "@/components/kpi";
import { MarkerDeltaCharts, type DeltaSeries } from "@/components/marker-delta-chart";
import { PageHeader } from "@/components/page-header";
import { RetestTrendChart } from "@/components/retest-trend-chart";
import { SegmentBarChart } from "@/components/segment-bar-chart";
import { SegmentMixChart } from "@/components/segment-mix-chart";
import { StateGrid } from "@/components/state-grid";
import { WhyThisPage } from "@/components/why";
import { openIntelligence, type Intelligence } from "@/lib/intelligence";
import { INTERVENTION_TYPES, MARKERS, MAX_SPECIFICITY, type Cell } from "@/lib/intelligence/guard";
import { parsePersona } from "@/lib/personas";

export const metadata: Metadata = { title: "Customer insights" };
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
        <PageHeader title="Customer insights" caption={CAPTION} status="seeded" reason="Database unavailable" />
        <EmptyState title="Could not load aggregates" body={`The database query failed: ${failure}. Check the Supabase env vars and try again.`} />
      </>
    );
  }

  const map = intel.aggregate({ dimensions: ["region_state"], measure: "leading_segment" });
  const retention = intel.aggregate({ dimensions: ["channel", "plan"], measure: "retest_rate" });
  const coverage = intel.aggregate({ dimensions: ["segment", "age_band"], measure: "count", filter: region ? { region_state: region } : undefined });
  const mix = intel.aggregate({ dimensions: ["segment", "age_band"], measure: "count" });
  const trend = intel.aggregate({ dimensions: ["month"], measure: "retest_rate" });
  const improvedBySegment = intel.aggregate({ dimensions: ["segment"], measure: "improved_rate" });
  const retestBySegment = intel.aggregate({ dimensions: ["segment"], measure: "retest_rate" });
  const overallRetest = intel.aggregate({ dimensions: [], measure: "retest_rate" }).cells[0];
  const overallImproved = intel.aggregate({ dimensions: [], measure: "improved_rate" }).cells[0];
  const deltas: DeltaSeries[] = INTERVENTION_TYPES.map((intervention) => ({
    intervention,
    points: MARKERS.map((marker) => {
      const cell = intel!.aggregate({ dimensions: [], measure: "marker_delta", marker, filter: { interventionType: intervention } }).cells[0];
      return { marker, delta: cell && !cell.suppressed ? cell.value : null, n: cell && !cell.suppressed ? cell.count : null };
    }),
  })).filter((s) => s.points.some((p) => p.delta !== null) || s.intervention !== "rx");

  const datasets = [
    { name: "Prevalence by state", dims: "region_state", measure: "leading_segment", result: map },
    { name: "Retention by channel and plan", dims: "channel,plan", measure: "retest_rate", result: retention },
    { name: "Coverage by segment and age band", dims: "segment,age_band", measure: "count", result: mix },
    { name: "Retest rate by signup month", dims: "month", measure: "retest_rate", result: trend },
    { name: "Improved at retest by segment", dims: "segment", measure: "improved_rate", result: improvedBySegment },
    { name: "Retest rate by segment", dims: "segment", measure: "retest_rate", result: retestBySegment },
  ];
  const suppressedTotal = datasets.reduce((a, d) => a + d.result.cells.filter((c) => c.suppressed).length, 0);
  const cellsTotal = datasets.reduce((a, d) => a + d.result.cells.length, 0);
  const suppressedStates = map.cells.filter((c) => c.suppressed).length;
  const value = (c: Cell | undefined) => (c && !c.suppressed && c.value !== null ? `${Math.round(c.value * 100)}%` : "n/a");

  return (
    <>
      <PageHeader title="Customer insights" caption={CAPTION} status="seeded" reason="Synthetic customers, real guard: every number passed the minimum-cohort check" />

      <WhyThisPage
        job="Where the root causes are, which interventions move which markers, and where the data is too thin to say, with no customer row ever leaving the database."
        steps={[
          { title: "One read path", body: "Every number here goes through the same guard: consent filter, group, then suppress any cell under the minimum cohort." },
          { title: "Suppression is visible", body: "Hatched means below the minimum, never zero. Raise the threshold and watch cells disappear; that is the product working." },
          { title: "Aggregates leave, rows never do", body: "Every dataset exports as CSV of guarded cells. There is no row export, not disabled: absent." },
        ]}
      />

      <KpiRow
        items={[
          { label: "Consenting customers", value: String(intel.consented), detail: `${Math.round((intel.consented / Math.max(1, intel.total)) * 100)}% of ${intel.total}. Only they count on this page.` },
          { label: "Retest rate", value: value(overallRetest), detail: overallRetest && !overallRetest.suppressed ? `${overallRetest.count} consenting customers` : "Suppressed", tone: "live" },
          { label: "Improved at retest", value: value(overallImproved), detail: overallImproved && !overallImproved.suppressed ? `Of ${overallImproved.count} with a baseline and a retest` : "Suppressed" },
          { label: "States with data", value: String(map.cells.length - suppressedStates), detail: `${suppressedStates} suppressed, ${51 - map.cells.length} with no consenting customers` },
          { label: "Cells suppressed", value: `${suppressedTotal} of ${cellsTotal}`, detail: "Across the six datasets on this page", tone: "seeded" },
          { label: "Minimum cohort", value: String(intel.minCohort), detail: `Editable below. Queries may combine at most ${MAX_SPECIFICITY} dimensions and filters.` },
        ]}
      />

      <div className="mt-8 grid gap-6 xl:grid-cols-2">
        <Card wide title="Prevalence by state" sub={`Leading root-cause segment among consenting customers. ${map.cells.length - suppressedStates} states shown, ${suppressedStates} hatched at a minimum cohort of ${intel.minCohort}.`}>
          <StateGrid cells={map.cells} />
        </Card>

        <Card title="Where the dataset is thin" sub="Consenting customers per segment and age band. Thin cells are where study-tier recruitment and creator seeding should go." action={<RegionFilter persona={persona} region={region} states={map.cells.map((c) => c.dims.region_state).sort()} />}>
          <CoverageHeatmap cells={coverage.cells} region={region} />
          <p className="mt-5 text-15">Segment mix by age band</p>
          <SegmentMixChart cells={mix.cells} />
        </Card>

        <Card title="Retest rate by signup month" sub="Share of each month's consenting customers who completed a retest. Recent months are low because their 90 days have not passed; a gap is a suppressed month.">
          <RetestTrendChart points={trend.cells.map((c) => ({ month: c.dims.month, rate: c.suppressed ? null : c.value, n: c.suppressed ? null : c.count }))} />
        </Card>

        <Card title="Improved at retest, by segment" sub="Of consenting customers with a baseline and a retest, the share whose markers improved. The number over each bar is the cohort behind it.">
          <SegmentBarChart label="improved" bars={improvedBySegment.cells.map((c) => ({ segment: c.dims.segment, value: c.suppressed ? null : c.value, n: c.suppressed ? null : c.count }))} />
        </Card>

        <Card title="Retention by channel and plan" sub="Retest rate: share of consenting customers with a completed retest panel. Membership-first and study customers come back; standalone customers mostly do not.">
          <RetentionTable cells={retention.cells} />
        </Card>

        <Card wide title="Retest rate by segment" sub="Which root causes come back for the second panel. Cortisol and insulin customers have the most to gain from a retest and tend to take it.">
          <SegmentBarChart label="retested" bars={retestBySegment.cells.map((c) => ({ segment: c.dims.segment, value: c.suppressed ? null : c.value, n: c.suppressed ? null : c.count }))} />
        </Card>
      </div>

      <section className="mt-8">
        <h2 className="text-24">Intervention to marker change</h2>
        <p className="text-15 text-muted">Customers with a baseline and a retest, grouped by the kind of intervention on their blueprint. Positive is toward optimal, in each marker&apos;s own units.</p>
        <MarkerDeltaCharts series={deltas} />
      </section>

      <section className="mt-10 grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(20rem,1fr)]">
        <div className="overflow-hidden rounded-panel border border-line">
          <div className="border-b border-line px-5 py-4">
            <h2 className="text-24">Downloads</h2>
            <p className="text-15 text-muted">Every dataset on this page as CSV. A file holds dimension values, counts and values; a suppressed cell prints the word suppressed. Nothing finer exists to download.</p>
          </div>
          <table className="w-full text-15">
            <thead className="bg-surface text-left text-13 text-muted">
              <tr>
                <th scope="col" className="px-5 py-2 font-medium">Dataset</th>
                <th scope="col" className="px-3 py-2 font-medium">Grouped by</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Cells</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Suppressed</th>
                <th scope="col" className="px-5 py-2 text-right font-medium">File</th>
              </tr>
            </thead>
            <tbody>
              {datasets.map((d) => (
                <tr key={d.name} className="border-t border-line">
                  <td className="px-5 py-2">{d.name}</td>
                  <td className="px-3 py-2 text-muted">{d.dims.replace(",", ", ").replace(/_/g, " ")}</td>
                  <td className="px-3 py-2 text-right">{d.result.cells.length}</td>
                  <td className="px-3 py-2 text-right">{d.result.cells.filter((c) => c.suppressed).length}</td>
                  <td className="px-5 py-2 text-right">
                    <a href={`/api/aggregates?dims=${d.dims}&measure=${d.measure}&format=csv`} className="rounded-control border border-line px-3 py-1 hover:bg-raised">Download CSV</a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Guardrails consentRate={intel.total ? intel.consented / intel.total : 0} consented={intel.consented} total={intel.total} minCohort={intel.minCohort} exports={[]} />
      </section>
    </>
  );
}

function Card({ title, sub, action, wide, children }: { title: string; sub: string; action?: React.ReactNode; wide?: boolean; children: React.ReactNode }) {
  return (
    <section className={`rounded-panel border border-line bg-surface p-5 ${wide ? "xl:col-span-2" : ""}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-18">{title}</h2>
          <p className="text-13 text-muted">{sub}</p>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function RegionFilter({ persona, region, states }: { persona: string; region: string | null; states: string[] }) {
  return (
    <form method="get" className="flex items-center gap-2 text-15">
      <input type="hidden" name="as" value={persona} />
      <label htmlFor="region" className="text-13 text-muted">State</label>
      <select id="region" name="region" defaultValue={region ?? ""} className="rounded-control border border-line bg-bg px-2 py-1 text-15 text-text">
        <option value="">All</option>
        {states.map((s) => <option key={s} value={s}>{s}</option>)}
      </select>
      <button type="submit" className="rounded-control border border-line px-3 py-1">Filter</button>
    </form>
  );
}

function RetentionTable({ cells }: { cells: Cell[] }) {
  const byKey = new Map(cells.map((c) => [`${c.dims.channel}|${c.dims.plan}`, c]));
  const max = Math.max(0.01, ...cells.map((c) => (c.suppressed ? 0 : c.value ?? 0)));
  return (
    <div className="mt-4 overflow-auto rounded-panel border border-line">
      <table className="w-full text-15">
        <thead className="bg-surface text-left text-13 text-muted">
          <tr>
            <th scope="col" className="px-3 py-2 font-medium">Channel</th>
            {PLANS.map((p) => <th key={p} scope="col" className="px-3 py-2 text-right font-medium">{p.replace("_", " ")}</th>)}
          </tr>
        </thead>
        <tbody>
          {CHANNELS.map((ch) => (
            <tr key={ch} className="border-t border-line">
              <td className="px-3 py-2">{ch}</td>
              {PLANS.map((p) => {
                const cell = byKey.get(`${ch}|${p}`);
                if (!cell) return <td key={p} className="px-3 py-2 text-right text-muted">–</td>;
                if (cell.suppressed) return <td key={p} className="hatched px-3 py-2 text-right text-muted" title="Below the minimum cohort">n/a</td>;
                const alpha = 0.1 + 0.45 * ((cell.value ?? 0) / max);
                return (
                  <td key={p} className="px-3 py-2 text-right" style={{ background: `color-mix(in oklab, var(--live) ${Math.round(alpha * 100)}%, var(--surface))` }}>
                    {Math.round((cell.value ?? 0) * 100)}% <span className="text-13">n {cell.count}</span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
