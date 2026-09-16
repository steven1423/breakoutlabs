import type { Metadata } from "next";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Intelligence" };

export default function IntelligencePage() {
  return (
    <>
      <PageHeader
        title="Intelligence"
        caption="We rent access to segments. We never sell data. The setting on the right is why."
        status="seeded"
      />
      {/* TODO(copy): placeholder until M6 adds guarded aggregates. */}
      <EmptyState
        title="No aggregates yet"
        body="The prevalence map, marker deltas, coverage heatmap and guardrails arrive in M6."
      />
    </>
  );
}
