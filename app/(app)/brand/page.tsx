import type { Metadata } from "next";
import { BrandSimulator, type BaselineCell } from "@/components/brand-simulator";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { openIntelligence } from "@/lib/intelligence";

export const metadata: Metadata = { title: "Partner brand portal" };
export const dynamic = "force-dynamic";

const CAPTION = "Year 3, as a product. Simulated on a synthetic cohort.";

export default async function BrandPage() {
  let baselines: BaselineCell[] = [];
  let fallbackRate: number | null = null;
  let fallbackCohort: number | null = null;
  let minCohort = 50;
  let failure: string | null = null;
  try {
    const intel = await openIntelligence();
    minCohort = intel.minCohort;
    const cells = intel.aggregate({ dimensions: ["segment", "age_band"], measure: "improved_rate" }).cells;
    baselines = cells.map((c) => ({ segment: c.dims.segment, ageBand: c.dims.age_band, improvedRate: c.suppressed ? null : c.value, cohort: c.suppressed ? null : c.count }));
    const all = intel.aggregate({ dimensions: [], measure: "improved_rate" }).cells[0];
    if (all && !all.suppressed && all.value !== null) {
      fallbackRate = all.value;
      fallbackCohort = all.count;
    }
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
      <p className="mt-4 max-w-3xl text-15 text-muted">
        What a supplement or skincare brand would see: pick the root-cause segment and age band your product fits, a budget and a window, and the portal simulates exposure to purchases to registrations to retests to outcomes, against a matched control drawn from the guarded aggregates. Nothing on this page writes to the database.
      </p>
      <BrandSimulator baselines={baselines} fallbackRate={fallbackRate} fallbackCohort={fallbackCohort} minCohort={minCohort} />
    </>
  );
}
