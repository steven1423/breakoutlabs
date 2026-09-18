import type { Metadata } from "next";
import { Suspense } from "react";
import { ModelCalculator } from "@/components/model-calculator";
import { PageHeader } from "@/components/page-header";
import { WhyThisPage } from "@/components/why";

export const metadata: Metadata = { title: "Valuation calculator" };

const CAPTION = "Price for the retest. Drag the retest rate and watch what the company is worth.";

export default function ModelPage() {
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

    </>
  );
}
