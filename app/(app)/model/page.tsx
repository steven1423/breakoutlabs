import type { Metadata } from "next";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Model" };

export default function ModelPage() {
  return (
    <>
      <PageHeader
        title="Model"
        caption="Price for the retest. Drag the retest rate and watch what the company is worth."
        status="seeded"
      />
      {/* TODO(copy): placeholder until M5 adds the calculator and timeline. */}
      <EmptyState
        title="No calculator yet"
        body="The path-to-$1B sliders and the Year 1 to Year 3 timeline arrive in M5."
      />
    </>
  );
}
