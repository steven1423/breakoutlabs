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
        job="Year 3's revenue line: a supplement or skincare brand pays to be on the blueprint of one root-cause segment, and buys proof, measured at the 90-day retest, that its product worked."
        steps={[
          { title: "What a brand buys", body: "Placement in front of customers whose blood test says their acne is, say, insulin-driven. Not an ad audience: a diagnosed cohort. Priced per retest, never per click." },
          { title: "What a brand sees", body: "Only guarded aggregates: how big the segment is, how many retest, what changed in their markers, and the improvement lift with its interval. Never a customer." },
          { title: "Why BreakoutLabs wins", body: "Nobody else has baseline, intervention and retest for acne. That record is what a brand pays for, and it is the brand-portal line in the valuation calculator." },
        ]}
      />
      <BrandSimulator baselines={baselines} deltas={deltas} summaries={summaries} fallbackRate={fallbackRate} fallbackCohort={fallbackCohort} minCohort={minCohort} consented={consented} />
    </>
  );
}
