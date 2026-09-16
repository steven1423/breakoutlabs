import type { Metadata } from "next";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Partner brand" };

export default function BrandPage() {
  return (
    <>
      <PageHeader
        title="Partner brand"
        caption="Year 3, as a product. Simulated on a synthetic cohort."
        status="seeded"
      />
      {/* TODO(copy): placeholder until M6 adds the simulated brand portal. */}
      <EmptyState
        title="No simulation yet"
        body="Segment, budget and window inputs with a simulated outcome lift arrive in M6."
      />
    </>
  );
}
