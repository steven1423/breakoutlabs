import seedrandom from "seedrandom";
import type { Segment } from "../intelligence/guard.ts";

/**
 * The partner-brand simulation (CLAUDE.md §10). Pure and seeded: the same inputs always give the same numbers.
 * Exposure → purchases → registered → retested → improved, for a treated cohort against a matched control.
 * Every rate below is an estimate for a synthetic cohort; the page says so on every number.
 */

export const AGE_BANDS = ["16-19", "20-24", "25-34", "35-44", "45+"] as const;
export const WINDOWS = [30, 60, 90] as const;
export type WindowDays = (typeof WINDOWS)[number];

export type BrandInputs = { segment: Segment; ageBand: string; budgetUsd: number; windowDays: WindowDays };

/** The share of a matched control that improves, from the guarded aggregate; null when that cell is suppressed. */
export type Baseline = { improvedRate: number | null; cohort: number | null; fallbackRate: number };

/** Estimated lift in improvement rate when the brand's product joins the blueprint. Labelled estimate in the UI. */
export const LIFT_BY_SEGMENT: Record<Segment, number> = { androgen: 0.09, insulin: 0.14, cortisol: 0.11, nutrient: 0.16, inflammation: 0.12, mixed: 0.08 };

export const CPM_USD = 18;
export const PURCHASE_RATE = 0.012;
export const REGISTER_RATE = 0.82;
export const RETEST_RATE_BY_WINDOW: Record<WindowDays, number> = { 30: 0.12, 60: 0.34, 90: 0.58 };

export type Simulation = {
  exposures: number;
  purchases: number;
  registered: number;
  retested: number;
  treatedImproved: number;
  treatedRate: number | null;
  controlSize: number;
  controlImproved: number;
  controlRate: number;
  liftPoints: number | null;
  liftRelative: number | null;
  baselineFromGuard: boolean;
  costPerRetest: number | null;
};

export function simulate(inputs: BrandInputs, baseline: Baseline): Simulation {
  const rng = seedrandom(`brand-${inputs.segment}-${inputs.ageBand}-${inputs.budgetUsd}-${inputs.windowDays}`);
  const exposures = Math.round((inputs.budgetUsd / CPM_USD) * 1000);
  const purchases = binomial(rng, exposures, PURCHASE_RATE * segmentAppeal(inputs.segment));
  const registered = binomial(rng, purchases, REGISTER_RATE);
  const retested = binomial(rng, registered, RETEST_RATE_BY_WINDOW[inputs.windowDays]);

  const controlRate = baseline.improvedRate ?? baseline.fallbackRate;
  const controlSize = Math.max(retested, baseline.cohort ?? retested);
  const controlImproved = binomial(rng, controlSize, controlRate);
  const treatedImproved = binomial(rng, retested, Math.min(0.98, controlRate + LIFT_BY_SEGMENT[inputs.segment]));
  const treatedRate = retested > 0 ? treatedImproved / retested : null;
  const observedControlRate = controlSize > 0 ? controlImproved / controlSize : controlRate;

  return {
    exposures,
    purchases,
    registered,
    retested,
    treatedImproved,
    treatedRate,
    controlSize,
    controlImproved,
    controlRate: observedControlRate,
    liftPoints: treatedRate === null ? null : treatedRate - observedControlRate,
    liftRelative: treatedRate === null || observedControlRate === 0 ? null : treatedRate / observedControlRate - 1,
    baselineFromGuard: baseline.improvedRate !== null,
    costPerRetest: retested > 0 ? inputs.budgetUsd / retested : null,
  };
}

/** Some segments convert better from a brand placement; a small, documented nudge around 1. */
function segmentAppeal(segment: Segment): number {
  return { androgen: 1.1, insulin: 1.0, cortisol: 0.95, nutrient: 1.15, inflammation: 0.9, mixed: 0.85 }[segment];
}

/** Sum of Bernoulli draws; exact for the sizes here and easy to explain. */
export function binomial(uniform: () => number, n: number, p: number): number {
  const clamped = Math.max(0, Math.min(1, p));
  let k = 0;
  for (let i = 0; i < n; i++) if (uniform() < clamped) k++;
  return k;
}
