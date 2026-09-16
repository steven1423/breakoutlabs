import type { Metadata } from "next";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Allocator" };

export default function AllocatorPage() {
  return (
    <>
      <PageHeader
        title="Allocator"
        caption="Budget follows retests, not followers."
        status="seeded"
      />
      {/* TODO(copy): placeholder until M4 adds the Thompson-sampling allocator. */}
      <EmptyState
        title="No allocator runs yet"
        body="Weekly Thompson-sampling runs and their posteriors arrive in M4."
      />
    </>
  );
}
