import type { Metadata } from "next";
import { Suspense } from "react";
import { ModelCalculator } from "@/components/model-calculator";
import { ModelTimeline } from "@/components/model-timeline";
import { PageHeader } from "@/components/page-header";
import { WhyThisPage } from "@/components/why";
import { parsePersona } from "@/lib/personas";

export const metadata: Metadata = { title: "Valuation calculator" };

const CAPTION = "Price for the retest. Drag the retest rate and watch what the company is worth.";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function ModelPage({ searchParams }: Props) {
  const persona = parsePersona((await searchParams).as);
  return (
    <>
      <PageHeader title="Valuation calculator" caption={CAPTION} status="seeded" reason="A model, not a forecast. Formulas in lib/model; inputs live in the URL." />
      <WhyThisPage
        job="Show that the retest rate, not the test price, is what decides what BreakoutLabs is worth, and let anyone check the arithmetic."
        steps={[
          { title: "Pick a pricing model", body: "Standalone sells a $249 test once. Membership first sells a $99 test and a $49 membership that makes the 90-day retest the default." },
          { title: "Drag the retest rate", body: "It drives the dataset, the members who stay, and the brand revenue that only exists once outcomes accumulate." },
          { title: "Read the valuation honestly", body: "ARR times a multiple you choose, with the range public comparables have traded in drawn on the chart." },
        ]}
      />
      <Suspense fallback={<p className="mt-8 text-15 text-muted">Loading the calculator.</p>}>
        <ModelCalculator />
      </Suspense>

      <section className="mt-10">
        <h2 className="text-24">The path, by year</h2>
        <p className="text-15 text-muted">Each milestone links to the part of BreakoutOS that unlocks it.</p>
        <ModelTimeline persona={persona} />
      </section>
    </>
  );
}
