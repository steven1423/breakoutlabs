import type { Metadata } from "next";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Growth" };

export default function GrowthPage() {
  return (
    <>
      <PageHeader
        title="Growth"
        caption="Discovery is a commodity. Ranking creators by retests is not."
        status="seeded"
      />
      {/* TODO(copy): placeholder until M4 adds creators, cards and the leaderboard. */}
      <EmptyState
        title="No creators yet"
        body="Creator discovery, AI cards and the cost-per-retest leaderboard arrive in M4."
      />
    </>
  );
}
