"use client";

import { useMemo, useState } from "react";
import { DataBadge } from "@/components/badge";
import { AGE_BANDS, LIFT_BY_SEGMENT, WINDOWS, simulate, type Baseline, type BrandInputs, type WindowDays } from "@/lib/brand/simulate";
import { SEGMENTS, type Segment } from "@/lib/intelligence/guard";

export type BaselineCell = { segment: string; ageBand: string; improvedRate: number | null; cohort: number | null };

type Props = { baselines: BaselineCell[]; fallbackRate: number; minCohort: number };

/** The brand's view of Year 3 (CLAUDE.md §10): pick a cohort, a budget and a window; see a simulated lift. Nothing here writes. */
export function BrandSimulator({ baselines, fallbackRate, minCohort }: Props) {
  const [inputs, setInputs] = useState<BrandInputs>({ segment: "insulin", ageBand: "25-34", budgetUsd: 20_000, windowDays: 90 });
  const baseline = useMemo<Baseline>(() => {
    const cell = baselines.find((b) => b.segment === inputs.segment && b.ageBand === inputs.ageBand);
    return { improvedRate: cell?.improvedRate ?? null, cohort: cell?.cohort ?? null, fallbackRate };
  }, [baselines, inputs.segment, inputs.ageBand, fallbackRate]);
  const sim = useMemo(() => simulate(inputs, baseline), [inputs, baseline]);

  return (
    <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <form className="flex flex-col gap-4 text-15" onSubmit={(e) => e.preventDefault()}>
        <Field label="Segment">
          <select value={inputs.segment} onChange={(e) => setInputs({ ...inputs, segment: e.target.value as Segment })} className="rounded-control border border-line bg-surface px-3 py-2 text-text">
            {SEGMENTS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="Age band">
          <select value={inputs.ageBand} onChange={(e) => setInputs({ ...inputs, ageBand: e.target.value })} className="rounded-control border border-line bg-surface px-3 py-2 text-text">
            {AGE_BANDS.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </Field>
        <Field label={`Budget ${usd(inputs.budgetUsd)}`}>
          <input type="range" min={5_000} max={100_000} step={1_000} value={inputs.budgetUsd} onChange={(e) => setInputs({ ...inputs, budgetUsd: Number(e.target.value) })} className="accent-live" />
        </Field>
        <Field label="Window">
          <div role="group" className="inline-flex rounded-control border border-line">
            {WINDOWS.map((w) => (
              <button key={w} type="button" aria-pressed={inputs.windowDays === w} onClick={() => setInputs({ ...inputs, windowDays: w as WindowDays })} className={`px-3 py-1.5 first:rounded-l-control last:rounded-r-control ${inputs.windowDays === w ? "bg-raised text-text" : "text-muted hover:text-text"}`}>
                {w} days
              </button>
            ))}
          </div>
        </Field>
        <p className="text-13 text-muted">
          Control cohort: {sim.baselineFromGuard ? `${baseline.cohort} consenting ${inputs.segment}, ${inputs.ageBand} customers with a retest, improvement rate ${pct(baseline.improvedRate ?? 0)} (guarded aggregate)` : `that cell is below the minimum cohort of ${minCohort}, so the all-segment rate ${pct(fallbackRate)} stands in`}.
          Lift estimate for {inputs.segment}: +{Math.round(LIFT_BY_SEGMENT[inputs.segment] * 100)} points.
        </p>
      </form>

      <div className="flex flex-col gap-6">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          <Tile label="Exposures" value={sim.exposures.toLocaleString("en-US")} />
          <Tile label="Purchases" value={sim.purchases.toLocaleString("en-US")} />
          <Tile label="Registered" value={sim.registered.toLocaleString("en-US")} />
          <Tile label="Retested in window" value={sim.retested.toLocaleString("en-US")} />
          <Tile label="Cost per retest" value={sim.costPerRetest === null ? "–" : usd(sim.costPerRetest)} />
          <Tile label="Outcome lift" value={sim.liftPoints === null ? "–" : `${sim.liftPoints >= 0 ? "+" : "−"}${Math.abs(Math.round(sim.liftPoints * 100))} pts`} accent />
        </div>
        <div className="rounded-panel border border-line bg-surface p-5 text-15">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-18">Improved at retest</p>
            <DataBadge status="seeded" reason="Simulated cohort" />
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-4">
            <div>
              <dt className="text-13 text-muted">With your product on the blueprint</dt>
              <dd className="text-24">{sim.treatedRate === null ? "–" : pct(sim.treatedRate)}</dd>
              <dd className="text-13 text-muted">{sim.treatedImproved} of {sim.retested}</dd>
            </div>
            <div>
              <dt className="text-13 text-muted">Matched control</dt>
              <dd className="text-24">{pct(sim.controlRate)}</dd>
              <dd className="text-13 text-muted">{sim.controlImproved} of {sim.controlSize}</dd>
            </div>
          </dl>
          <p className="mt-3 text-13 text-muted">
            {sim.liftRelative === null ? "Not enough retests in this window to compare." : `Relative lift ${sim.liftRelative >= 0 ? "+" : ""}${Math.round(sim.liftRelative * 100)}%.`} Simulated on a synthetic cohort. In production this runs on guarded aggregates; brands never see customer rows.
          </p>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-13 text-muted">{label}</span>
      {children}
    </label>
  );
}

function Tile({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded-panel border bg-surface px-4 py-3 ${accent ? "border-accent" : "border-line"}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-13 text-muted">{label}</p>
        <DataBadge status="seeded" />
      </div>
      <p className="text-24">{value}</p>
    </div>
  );
}

const usd = (v: number) => `$${Math.round(v).toLocaleString("en-US")}`;
const pct = (v: number) => `${Math.round(v * 100)}%`;
