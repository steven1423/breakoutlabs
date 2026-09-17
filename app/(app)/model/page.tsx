import type { Metadata } from "next";
import { Suspense } from "react";
import { ModelCalculator } from "@/components/model-calculator";
import { ModelTimeline } from "@/components/model-timeline";
import { PageHeader } from "@/components/page-header";
import { parsePersona } from "@/lib/personas";

export const metadata: Metadata = { title: "Model" };

const CAPTION = "Price for the retest. Drag the retest rate and watch what the company is worth.";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function ModelPage({ searchParams }: Props) {
  const persona = parsePersona((await searchParams).as);
  return (
    <>
      <PageHeader title="Model" caption={CAPTION} status="seeded" reason="A model, not a forecast. Formulas in lib/model; inputs live in the URL." />
      <Suspense fallback={<p className="mt-8 text-15 text-muted">Loading the calculator.</p>}>
        <ModelCalculator />
      </Suspense>

      <section className="mt-10">
        <h2 className="text-24">What the multiple is anchored to</h2>
        <p className="mt-2 max-w-3xl text-15 text-muted">
          The 6× to 25× range brackets public reporting on consumer-health companies with a recurring test. Function Health has been reported at about a $2.5B valuation on a run-rate reported above $100M; those are press figures, not audited numbers, and private multiples move with the market. The slider is there so you can pick your own.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-24">The path, by year</h2>
        <p className="text-15 text-muted">Each milestone links to the part of BreakoutOS that unlocks it.</p>
        <ModelTimeline persona={persona} />
      </section>
    </>
  );
}
