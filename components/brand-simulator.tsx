"use client";

import { useMemo, useState } from "react";
import { DataBadge } from "@/components/badge";
import { FunnelChart } from "@/components/funnel-chart";
import { Kpi } from "@/components/kpi";
import { OutcomeChart } from "@/components/outcome-chart";
import { AGE_BANDS, CPM_USD, LIFT_BY_SEGMENT, WINDOWS, controlRateFor, simulate, type Baseline, type BrandInputs, type WindowDays } from "@/lib/brand/simulate";
import { SEGMENTS, type Segment } from "@/lib/intelligence/guard";

export type BaselineCell = { segment: string; ageBand: string; improvedRate: number | null; cohort: number | null };
export type SegmentDelta = { segment: string; marker: string; delta: number | null; n: number | null };
export type SegmentSummary = { segment: string; customers: number | null; share: number | null; retestRate: number | null; improvedRate: number | null; improvedCohort: number | null };

type Props = {
  baselines: BaselineCell[];
  deltas: SegmentDelta[];
  summaries: SegmentSummary[];
  fallbackRate: number | null;
  fallbackCohort: number | null;
  minCohort: number;
  consented: number;
};

const MARKER_LABEL: Record<string, string> = { testosterone: "Testosterone", dhea_s: "DHEA-S", shbg: "SHBG", cortisol: "Cortisol", insulin: "Insulin", vitamin_d: "Vitamin D", zinc: "Zinc", hs_crp: "hs-CRP" };
const SEGMENT_LABEL: Record<string, string> = { androgen: "Androgen", insulin: "Insulin", cortisol: "Cortisol", nutrient: "Nutrient", inflammation: "Inflammation", mixed: "Mixed" };

/** The brand's view of Year 3 (CLAUDE.md §10): pick a cohort, a budget and a window; see a simulated funnel and lift. Nothing here writes. */
export function BrandSimulator({ baselines, deltas, summaries, fallbackRate, fallbackCohort, minCohort, consented }: Props) {
  const [inputs, setInputs] = useState<BrandInputs>({ segment: "insulin", ageBand: "25-34", budgetUsd: 20_000, windowDays: 90 });
  const baseline = useMemo<Baseline>(() => {
    const cell = baselines.find((b) => b.segment === inputs.segment && b.ageBand === inputs.ageBand);
    return { improvedRate: cell?.improvedRate ?? null, cohort: cell?.cohort ?? null, fallbackRate, fallbackCohort };
  }, [baselines, inputs.segment, inputs.ageBand, fallbackRate, fallbackCohort]);
  const sim = useMemo(() => simulate(inputs, baseline), [inputs, baseline]);
  const controlRate = controlRateFor(baseline);
  const segmentDeltas = deltas.filter((d) => d.segment === inputs.segment);
  const summary = summaries.find((s) => s.segment === inputs.segment);

  const summaryCustomers = summary?.customers ?? null;
  return (
    <>
      <section aria-label="What the brand is buying" className="mt-6 grid gap-4 rounded-panel border border-brand/40 bg-surface p-5 md:grid-cols-3">
        <div>
          <p className="text-13 text-muted">You are buying</p>
          <p className="mt-1 text-18">Placement on the Clear Skin Blueprint of {SEGMENT_LABEL[inputs.segment].toLowerCase()}-driven customers aged {inputs.ageBand}</p>
          <p className="mt-1 text-13 text-muted">{summaryCustomers === null ? "The segment is below the minimum cohort, so its size is not shown." : `${summaryCustomers} consenting customers in this segment today, ${pct(summary?.share ?? 0)} of the dataset. Every one of them has a blood panel that says why they break out.`}</p>
        </div>
        <div>
          <p className="text-13 text-muted">You get back</p>
          <p className="mt-1 text-18">Retests, not clicks: how many of your buyers came back at 90 days and whether their markers moved</p>
          <p className="mt-1 text-13 text-muted">A control cohort from the same segment, untreated, and the difference with a 95% interval. When the cohort is too small to tell, the portal says so instead of rounding up.</p>
        </div>
        <div>
          <p className="text-13 text-muted">You never see</p>
          <p className="mt-1 text-18">A customer. Names, emails, individual results and rows do not exist on this side of the guard</p>
          <p className="mt-1 text-13 text-muted">Cells under the minimum cohort of {minCohort} are suppressed before anything reaches this page. This is the setting on the Customer insights page, applied here.</p>
        </div>
      </section>

    <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,3fr)]">
      <form className="flex flex-col gap-4 self-start rounded-panel border border-line bg-surface p-5 text-15" onSubmit={(e) => e.preventDefault()}>
        <p className="text-18">Your placement</p>
        <Field label="Root-cause segment">
          <select value={inputs.segment} onChange={(e) => setInputs({ ...inputs, segment: e.target.value as Segment })} className="rounded-control border border-line bg-bg px-3 py-2 text-text">
            {SEGMENTS.map((s) => <option key={s} value={s}>{SEGMENT_LABEL[s]}</option>)}
          </select>
        </Field>
        <Field label="Age band">
          <select value={inputs.ageBand} onChange={(e) => setInputs({ ...inputs, ageBand: e.target.value })} className="rounded-control border border-line bg-bg px-3 py-2 text-text">
            {AGE_BANDS.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </Field>
        <Field label={`Budget ${usd(inputs.budgetUsd)}`}>
          <input type="range" min={5_000} max={100_000} step={1_000} value={inputs.budgetUsd} onChange={(e) => setInputs({ ...inputs, budgetUsd: Number(e.target.value) })} className="accent-brand" />
        </Field>
        <Field label="Measurement window">
          <div role="group" className="inline-flex rounded-control border border-line">
            {WINDOWS.map((w) => (
              <button key={w} type="button" aria-pressed={inputs.windowDays === w} onClick={() => setInputs({ ...inputs, windowDays: w as WindowDays })} className={`px-3 py-1.5 first:rounded-l-control last:rounded-r-control ${inputs.windowDays === w ? "bg-raised text-text" : "text-muted hover:text-text"}`}>
                {w} days
              </button>
            ))}
          </div>
        </Field>
        <div className="border-t border-line pt-4 text-13 text-muted">
          <p>
            <span className="text-text">Control cohort. </span>
            {sim === null
              ? `No cohort survives the minimum of ${minCohort}, so there is nothing to compare against.`
              : sim.baselineFromGuard
                ? `${baseline.cohort} consenting ${SEGMENT_LABEL[inputs.segment].toLowerCase()}, ${inputs.ageBand} customers with a retest, improving at ${pct(baseline.improvedRate ?? 0)}. A guarded aggregate.`
                : `That cell is below the minimum cohort of ${minCohort}, so the guarded all-segment rate of ${pct(controlRate ?? 0)}, measured on ${fallbackCohort} customers, stands in.`}
          </p>
          <p className="mt-2">
            <span className="text-text">Lift estimate. </span>
            {sim === null
              ? ""
              : sim.liftCapped
                ? `+${Math.round(LIFT_BY_SEGMENT[inputs.segment] * 100)} points for ${SEGMENT_LABEL[inputs.segment].toLowerCase()}, applied as +${Math.round(sim.effectiveLift * 100)} because the control already improves at ${pct(controlRate ?? 0)} and no cohort exceeds 98%.`
                : `+${Math.round(sim.effectiveLift * 100)} points for ${SEGMENT_LABEL[inputs.segment].toLowerCase()}, from the product's evidence base.`}
          </p>
          <p className="mt-2">CPM ${CPM_USD}. Purchases per impression 0.01%, registration 82%, retest within the window 12%, 34% or 58%. All estimates.</p>
        </div>
      </form>

      {sim === null ? (
        <div className="rounded-panel border border-seeded bg-surface p-5 text-15">
          <p className="text-18">No control cohort at this threshold</p>
          <p className="mt-2 text-muted">
            The minimum cohort is {minCohort}, and every cell that could serve as an untreated comparison has fewer people than that, so the guard suppresses it. Rather than substitute a number, the portal stops here. Lower the threshold on the Customer insights page and this simulation returns. This is the guard doing its job, not a failure.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <Kpi label="Impressions" value={compact(sim.exposures)} detail={`${usd(inputs.budgetUsd)} at a $${CPM_USD} CPM`} />
            <Kpi label="Purchases" value={sim.purchases.toLocaleString("en-US")} detail={`${usd(sim.purchases ? inputs.budgetUsd / sim.purchases : 0)} per test sold`} />
            <Kpi label="Retested in window" value={sim.retested.toLocaleString("en-US")} detail={`${sim.registered} registered, ${pct(sim.registered ? sim.retested / sim.registered : 0)} of them retested`} />
            <Kpi label="Cost per retest" value={sim.costPerRetest === null ? "–" : usd(sim.costPerRetest)} detail="Budget over customers who completed the loop" />
            <Kpi label="Improved at retest" value={sim.treatedRate === null ? "–" : pct(sim.treatedRate)} detail={`${sim.treatedImproved} of ${sim.retested} with your product on the blueprint`} />
            <Kpi label="Lift over control" value={sim.liftPoints === null ? "–" : pts(sim.liftPoints)} detail={`95% interval ${pts(sim.liftInterval[0])} to ${pts(sim.liftInterval[1])}`} tone={sim.liftResolved ? "live" : "seeded"} />
          </div>
          <p className="text-13 text-muted">
            The other side of the deal: this placement is {usd(inputs.budgetUsd)} of brand-portal revenue to BreakoutLabs for {sim.retested} retested customers, {usd(sim.retested ? inputs.budgetUsd / sim.retested : 0)} each, against the $120 of partner GMV per retested customer per year the valuation calculator assumes.
          </p>

          <div className="grid gap-6 lg:grid-cols-2">
            <figure className="rounded-panel border border-line bg-surface p-5">
              <div className="flex items-center justify-between gap-3">
                <figcaption className="text-18">From budget to retests</figcaption>
                <DataBadge status="seeded" reason="Simulated" />
              </div>
              <p className="mb-2 text-13 text-muted">Every step the money passes through. Hover a bar for its conversion from the step before.</p>
              <FunnelChart steps={[
                { step: "Impressions", value: sim.exposures },
                { step: "Purchases", value: sim.purchases },
                { step: "Registered a kit", value: sim.registered },
                { step: `Retested in ${inputs.windowDays} days`, value: sim.retested },
                { step: "Improved at retest", value: sim.treatedImproved },
              ]} />
            </figure>

            <figure className="rounded-panel border border-line bg-surface p-5">
              <div className="flex items-center justify-between gap-3">
                <figcaption className="text-18">Improved at retest, your cohort against the control</figcaption>
                <DataBadge status="seeded" reason="Simulated" />
              </div>
              <p className="mb-2 text-13 text-muted">The whiskers are 95% intervals. When they overlap, the cohorts are too small to tell the arms apart.</p>
              <OutcomeChart bars={[
                { arm: "With your product", rate: sim.treatedRate ?? 0, n: sim.retested, error: sim.retested > 0 ? 1.96 * Math.sqrt(((sim.treatedRate ?? 0) * (1 - (sim.treatedRate ?? 0))) / sim.retested) : 0 },
                { arm: "Control, untreated", rate: sim.controlRate, n: sim.controlSize, error: sim.controlSize > 0 ? 1.96 * Math.sqrt((sim.controlRate * (1 - sim.controlRate)) / sim.controlSize) : 0 },
              ]} />
              <p className="mt-2 text-13 text-muted">
                {sim.liftResolved
                  ? `Expected +${Math.round(sim.effectiveLift * 100)} points, observed ${pts(sim.liftPoints ?? 0)}. The interval excludes zero: this cohort is large enough to see the effect.`
                  : `Expected +${Math.round(sim.effectiveLift * 100)} points, observed ${pts(sim.liftPoints ?? 0)}. The interval includes zero: ${sim.retested} retests against a control of ${sim.controlSize} cannot resolve an effect this size. Volume of retests is what makes this measurable.`}
              </p>
            </figure>
          </div>

          <section className="rounded-panel border border-line bg-surface p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-18">What the {SEGMENT_LABEL[inputs.segment].toLowerCase()} segment looks like today</h2>
              <DataBadge status="seeded" reason={`Guarded aggregates over ${consented} consenting customers, minimum cohort ${minCohort}`} />
            </div>
            <p className="mb-3 text-13 text-muted">The same numbers a brand would license in production. Mean change at retest, in each marker&apos;s own units, positive is toward optimal; n is the customers behind each bar.</p>
            <div className="grid gap-x-8 gap-y-2 sm:grid-cols-2 xl:grid-cols-4">
              {segmentDeltas.map((d) => (
                <div key={d.marker} className="flex items-baseline justify-between border-b border-line py-1.5 text-15">
                  <span>{MARKER_LABEL[d.marker] ?? d.marker}</span>
                  {d.delta === null ? <span className="hatched rounded-control px-2 text-13 text-muted" title="Below the minimum cohort">n/a</span> : <span>{d.delta >= 0 ? "+" : "−"}{Math.abs(d.delta).toFixed(2)} <span className="text-13 text-muted">n {d.n}</span></span>}
                </div>
              ))}
            </div>
            <div className="mt-5 overflow-auto rounded-panel border border-line">
              <table className="w-full text-15">
                <thead className="bg-surface text-left text-13 text-muted">
                  <tr>
                    <th scope="col" className="px-3 py-2 font-medium">Segment</th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">Consenting customers</th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">Share</th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">Retest rate</th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">Improved at retest</th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">Lift estimate</th>
                  </tr>
                </thead>
                <tbody>
                  {summaries.map((s) => (
                    <tr key={s.segment} className={`border-t border-line ${s.segment === inputs.segment ? "bg-raised" : ""}`}>
                      <td className="px-3 py-2">{SEGMENT_LABEL[s.segment]}</td>
                      <td className="px-3 py-2 text-right">{s.customers === null ? <Suppressed /> : s.customers}</td>
                      <td className="px-3 py-2 text-right">{s.share === null ? <Suppressed /> : pct(s.share)}</td>
                      <td className="px-3 py-2 text-right">{s.retestRate === null ? <Suppressed /> : pct(s.retestRate)}</td>
                      <td className="px-3 py-2 text-right">{s.improvedRate === null ? <Suppressed /> : <>{pct(s.improvedRate)} <span className="text-13 text-muted">n {s.improvedCohort}</span></>}</td>
                      <td className="px-3 py-2 text-right text-muted">+{Math.round(LIFT_BY_SEGMENT[s.segment as Segment] * 100)} pts</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-13 text-muted">{summary?.customers === null ? "The selected segment is below the minimum cohort, so its row is suppressed." : ""} Simulated on a synthetic cohort. In production this runs on guarded aggregates; brands never see customer rows.</p>
          </section>
        </div>
      )}
    </div>
    </>
  );
}

function Suppressed() {
  return <span className="hatched rounded-control px-2 text-13 text-muted" title="Below the minimum cohort">n/a</span>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-13 text-muted">{label}</span>
      {children}
    </label>
  );
}

const compact = (v: number) => (v >= 1_000_000 ? `${(v / 1_000_000).toFixed(2)}M` : v.toLocaleString("en-US"));
const usd = (v: number) => `$${Math.round(v).toLocaleString("en-US")}`;
const pct = (v: number) => `${Math.round(v * 100)}%`;
const pts = (v: number) => `${v >= 0 ? "+" : "−"}${Math.abs(Math.round(v * 100))} pts`;
