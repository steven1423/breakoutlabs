import type { Metadata } from "next";
import { BrandSimulator, type BaselineCell, type SegmentDelta, type SegmentSummary } from "@/components/brand-simulator";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { WhyThisPage } from "@/components/why";
import { openIntelligence } from "@/lib/intelligence";
import { MARKERS, SEGMENTS } from "@/lib/intelligence/guard";

export const metadata: Metadata = { title: "Partner brand portal" };
export const dynamic = "force-dynamic";

const CAPTION = "Year 3, as a product. Simulated on a synthetic cohort.";

export default async function BrandPage() {
  let baselines: BaselineCell[] = [];
  let deltas: SegmentDelta[] = [];
  let summaries: SegmentSummary[] = [];
  let fallbackRate: number | null = null;
  let fallbackCohort: number | null = null;
  let minCohort = 50;
  let consented = 0;
  let failure: string | null = null;
  try {
    const intel = await openIntelligence();
    minCohort = intel.minCohort;
    consented = intel.consented;
    const cells = intel.aggregate({ dimensions: ["segment", "age_band"], measure: "improved_rate" }).cells;
    baselines = cells.map((c) => ({ segment: c.dims.segment, ageBand: c.dims.age_band, improvedRate: c.suppressed ? null : c.value, cohort: c.suppressed ? null : c.count }));
    const all = intel.aggregate({ dimensions: [], measure: "improved_rate" }).cells[0];
    if (all && !all.suppressed && all.value !== null) {
      fallbackRate = all.value;
      fallbackCohort = all.count;
    }
    // Every number a brand sees comes through the guard: the mean marker change for the segment
    // it is buying into, and the size, retest rate and improvement rate of each segment.
    deltas = SEGMENTS.flatMap((segment) =>
      MARKERS.map((marker) => {
        const cell = intel.aggregate({ dimensions: [], measure: "marker_delta", marker, filter: { segment } }).cells[0];
        return { segment, marker, delta: cell && !cell.suppressed ? cell.value : null, n: cell && !cell.suppressed ? cell.count : null };
      }),
    );
    const share = intel.aggregate({ dimensions: ["segment"], measure: "share" }).cells;
    const retest = intel.aggregate({ dimensions: ["segment"], measure: "retest_rate" }).cells;
    const improved = intel.aggregate({ dimensions: ["segment"], measure: "improved_rate" }).cells;
    summaries = SEGMENTS.map((segment) => {
      const s = share.find((c) => c.dims.segment === segment);
      const r = retest.find((c) => c.dims.segment === segment);
      const i = improved.find((c) => c.dims.segment === segment);
      return {
        segment,
        customers: s && !s.suppressed ? s.count : null,
        share: s && !s.suppressed ? s.value : null,
        retestRate: r && !r.suppressed ? r.value : null,
        improvedRate: i && !i.suppressed ? i.value : null,
        improvedCohort: i && !i.suppressed ? i.count : null,
      };
    });
  } catch (err) {
    failure = err instanceof Error ? err.message : "Unknown error";
  }
  if (failure) {
    return (
      <>
        <PageHeader title="Partner brand portal" caption={CAPTION} status="seeded" reason="Database unavailable" />
        <EmptyState title="Could not load the control cohort" body={`The database query failed: ${failure}. Check the Supabase env vars and try again.`} />
      </>
    );
  }
  return (
    <>
      <PageHeader title="Partner brand portal" caption={CAPTION} status="seeded" reason="Simulated on a synthetic cohort. Brands never see customer rows." />
      <WhyThisPage
        job="Show a supplement or skincare brand what it would buy from BreakoutLabs in Year 3: placement in front of a root-cause segment, measured by retests instead of clicks."
        steps={[
          { title: "Pick the cohort", body: "The root-cause segment and age band the product fits. The portal only ever shows guarded aggregates for it." },
          { title: "Set a budget", body: "Impressions, purchases, registrations and retests follow from it. Every rate is an estimate and says so." },
          { title: "Read the lift honestly", body: "Improvement at retest against a matched control, with the interval. When the cohort is too small to tell, the portal says that too." },
        ]}
      />
      <BrandSimulator baselines={baselines} deltas={deltas} summaries={summaries} fallbackRate={fallbackRate} fallbackCohort={fallbackCohort} minCohort={minCohort} consented={consented} />
    </>
  );
}
