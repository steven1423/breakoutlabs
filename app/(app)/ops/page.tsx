import type { Metadata } from "next";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Ops" };

export default function OpsPage() {
  return (
    <>
      <PageHeader
        title="Ops"
        caption="Every one-star review is a missing state transition. This is where they get caught."
        status="seeded"
      />
      {/* TODO(copy): placeholder until M1 seeds kits and M2 adds the state machine. */}
      <EmptyState
        title="No kits yet"
        body="The kit rail, stuck-kit queue and tickets arrive with the synthetic data in M1 and the state machine in M2."
      />
    </>
  );
}
