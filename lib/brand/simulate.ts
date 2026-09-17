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

/**
 * The share of an untreated cohort that improves, always from a guarded aggregate.
 * `improvedRate` is the segment and age band cell; `fallbackRate` is the all-segment cell that
 * stands in when that one is suppressed. Both can be null: at a high enough minimum cohort the
 * guard suppresses even the all-segment cell, and then there is no control to simulate against.
 * We never substitute a made-up number for a suppressed one.
 */
export type Baseline = { improvedRate: number | null; cohort: number | null; fallbackRate: number | null; fallbackCohort: number | null };

/** The rate the simulation will use, or null when the guard leaves us without one. */
export function controlRateFor(baseline: Baseline): number | null {
  return baseline.improvedRate ?? baseline.fallbackRate;
}

/** Estimated lift in improvement rate when the brand's product joins the blueprint. Labelled estimate in the UI. */
export const LIFT_BY_SEGMENT: Record<Segment, number> = { androgen: 0.09, insulin: 0.14, cortisol: 0.11, nutrient: 0.16, inflammation: 0.12, mixed: 0.08 };

export const CPM_USD = 18;
/**
 * Purchases per impression for a $199-249 at-home test sold from a brand placement: about a
 * half-percent click-through and a two-percent conversion on the landing page. It implies an
 * acquisition cost near $180, which is the range a direct-to-consumer health founder recognises.
 */
export const PURCHASE_RATE = 0.0001;
export const REGISTER_RATE = 0.82;
export const RETEST_RATE_BY_WINDOW: Record<WindowDays, number> = { 30: 0.12, 60: 0.34, 90: 0.58 };

export type Simulation = {
  exposures: number;
  purchases: number;
  registered: number;
  retested: number;
  treatedImproved: number;
  treatedRate: number | null;
  /** The lift actually applied after the 98% ceiling, which is what the treated rate reflects. */
  effectiveLift: number;
  liftCapped: boolean;
  /** 95% interval on the observed difference between the two arms. */
  liftInterval: [number, number];
  /** False when that interval straddles zero: the cohorts are too small to resolve the effect. */
  liftResolved: boolean;
  controlSize: number;
  controlImproved: number;
  controlRate: number;
  liftPoints: number | null;
  liftRelative: number | null;
  baselineFromGuard: boolean;
  costPerRetest: number | null;
};

/** Returns null when the guard leaves no control cohort; the page says so rather than inventing one. */
export function simulate(inputs: BrandInputs, baseline: Baseline): Simulation | null {
  const controlRate = controlRateFor(baseline);
  if (controlRate === null) return null;
  // The window is not in the seed: how long you wait for a retest cannot change how many people bought.
  const rng = seedrandom(`brand-${inputs.segment}-${inputs.ageBand}-${inputs.budgetUsd}`);
  const exposures = Math.round((inputs.budgetUsd / CPM_USD) * 1000);
  const purchases = binomial(rng, exposures, PURCHASE_RATE * segmentAppeal(inputs.segment));
  const registered = binomial(rng, purchases, REGISTER_RATE);
  const retested = binomial(rng, registered, RETEST_RATE_BY_WINDOW[inputs.windowDays]);

  // The control is the cohort the guarded rate was measured on, not a cohort we wished into being.
  const controlSize = baseline.cohort ?? baseline.fallbackCohort ?? retested;
  const controlImproved = binomial(rng, controlSize, controlRate);
  // A ceiling, because no intervention takes a cohort to certainty. When the control already
  // improves at 89% the declared segment lift cannot fit underneath it, so report what was used.
  const treatedProbability = Math.min(0.98, controlRate + LIFT_BY_SEGMENT[inputs.segment]);
  const effectiveLift = treatedProbability - controlRate;
  const treatedImproved = binomial(rng, retested, treatedProbability);
  const treatedRate = retested > 0 ? treatedImproved / retested : null;
  const observedControl = controlSize > 0 ? controlImproved / controlSize : controlRate;
  const difference = (treatedRate ?? observedControl) - observedControl;
  const interval = confidenceInterval(difference, treatedRate ?? observedControl, retested, observedControl, controlSize);

  return {
    exposures,
    purchases,
    registered,
    retested,
    treatedImproved,
    treatedRate,
    effectiveLift,
    liftCapped: effectiveLift < LIFT_BY_SEGMENT[inputs.segment] - 1e-9,
    liftInterval: interval,
    liftResolved: interval[0] > 0 || interval[1] < 0,
    controlSize,
    controlImproved,
    controlRate: observedControl,
    liftPoints: treatedRate === null ? null : treatedRate - observedControl,
    liftRelative: treatedRate === null || observedControl === 0 ? null : treatedRate / observedControl - 1,
    baselineFromGuard: baseline.improvedRate !== null,
    costPerRetest: retested > 0 ? inputs.budgetUsd / retested : null,
  };
}

/**
 * 95% interval on the difference between two proportions. It is here because with a few dozen
 * retests on each side the noise is larger than any plausible product effect, and a portal that
 * hides that is selling a number it cannot support. This is the argument for volume of retests.
 */
export function confidenceInterval(difference: number, p1: number, n1: number, p2: number, n2: number): [number, number] {
  if (n1 < 1 || n2 < 1) return [difference, difference];
  const se = Math.sqrt((p1 * (1 - p1)) / n1 + (p2 * (1 - p2)) / n2);
  return [difference - 1.96 * se, difference + 1.96 * se];
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
