import { describe, expect, it } from "vitest";
import { LIFT_BY_SEGMENT, binomial, controlRateFor, simulate, type Baseline, type BrandInputs } from "@/lib/brand/simulate";

const inputs: BrandInputs = { segment: "insulin", ageBand: "25-34", budgetUsd: 20_000, windowDays: 90 };
const baseline: Baseline = { improvedRate: 0.55, cohort: 40, fallbackRate: 0.5, fallbackCohort: 37 };
const run = (i: BrandInputs = inputs, b: Baseline = baseline) => {
  const s = simulate(i, b);
  if (s === null) throw new Error("expected a simulation");
  return s;
};

describe("brand simulation (§10)", () => {
  it("is deterministic for the same inputs and differs for different ones", () => {
    expect(run()).toEqual(run());
    expect(run({ ...inputs, budgetUsd: 25_000 })).not.toEqual(run());
  });

  it("follows the funnel: exposures ≥ purchases ≥ registered ≥ retested ≥ improved, and a bigger budget exposes more", () => {
    const s = run();
    expect(s.exposures).toBeGreaterThanOrEqual(s.purchases);
    expect(s.purchases).toBeGreaterThanOrEqual(s.registered);
    expect(s.registered).toBeGreaterThanOrEqual(s.retested);
    expect(s.retested).toBeGreaterThanOrEqual(s.treatedImproved);
    expect(run({ ...inputs, budgetUsd: 40_000 }).exposures).toBe(2 * s.exposures);
  });

  it("implies an acquisition cost a consumer-health founder would recognise", () => {
    const s = run();
    const cac = inputs.budgetUsd / s.purchases;
    expect(cac).toBeGreaterThan(80);
    expect(cac).toBeLessThan(400);
  });

  it("the retest window changes retests but never purchases or registrations", () => {
    const short = run({ ...inputs, windowDays: 30 });
    const long = run({ ...inputs, windowDays: 90 });
    expect(long.purchases).toBe(short.purchases);
    expect(long.registered).toBe(short.registered);
    expect(long.retested).toBeGreaterThan(short.retested);
  });

  it("reports the treated rate, the control rate, the lift and both sample sizes", () => {
    const s = run();
    expect(s.controlSize).toBe(40);
    expect(s.treatedRate).not.toBeNull();
    expect(s.liftPoints).toBeCloseTo(s.treatedRate! - s.controlRate, 10);
    expect(s.baselineFromGuard).toBe(true);
    expect(s.costPerRetest).toBeCloseTo(20_000 / s.retested);
  });

  it("reports the lift it actually applied, and says when the ceiling ate it", () => {
    const roomy = run(inputs, { improvedRate: 0.5, cohort: 40, fallbackRate: null, fallbackCohort: null });
    expect(roomy.effectiveLift).toBeCloseTo(LIFT_BY_SEGMENT.insulin);
    expect(roomy.liftCapped).toBe(false);
    const tight = run(inputs, { improvedRate: 0.89, cohort: 40, fallbackRate: null, fallbackCohort: null });
    expect(tight.effectiveLift).toBeCloseTo(0.98 - 0.89);
    expect(tight.liftCapped).toBe(true);
    expect(tight.effectiveLift).toBeLessThan(LIFT_BY_SEGMENT.insulin);
  });

  it("falls back to the guarded all-segment rate when the cell is suppressed, and says so", () => {
    const s = run(inputs, { improvedRate: null, cohort: null, fallbackRate: 0.5, fallbackCohort: 37 });
    expect(s.baselineFromGuard).toBe(false);
    // The control is the all-segment cohort the fallback rate was measured on, not the treated arm.
    expect(s.controlSize).toBe(37);
  });

  it("returns nothing at all when the guard leaves no control cohort, rather than inventing a rate", () => {
    const none: Baseline = { improvedRate: null, cohort: null, fallbackRate: null, fallbackCohort: null };
    expect(controlRateFor(none)).toBeNull();
    expect(simulate(inputs, none)).toBeNull();
  });

  it("reports a confidence interval on the observed difference and says when it cannot resolve the effect", () => {
    const small = run(inputs, { improvedRate: 0.5, cohort: 20, fallbackRate: null, fallbackCohort: null });
    expect(small.liftInterval[0]).toBeLessThan(small.liftInterval[1]);
    expect(small.liftPoints).toBeGreaterThan(small.liftInterval[0]);
    expect(small.liftPoints).toBeLessThan(small.liftInterval[1]);
    expect(small.liftResolved).toBe(small.liftInterval[0] > 0 || small.liftInterval[1] < 0);
    const wide = run({ ...inputs, budgetUsd: 100_000 }, { improvedRate: 0.5, cohort: 4_000, fallbackRate: null, fallbackCohort: null });
    expect(wide.liftInterval[1] - wide.liftInterval[0]).toBeLessThan(small.liftInterval[1] - small.liftInterval[0]);
  });

  it("the control cohort is the size the guarded rate was measured on, not one we wished into being", () => {
    expect(run(inputs, { improvedRate: 0.55, cohort: 37, fallbackRate: null, fallbackCohort: null }).controlSize).toBe(37);
    expect(run(inputs, { improvedRate: null, cohort: null, fallbackRate: 0.6, fallbackCohort: 29 }).controlSize).toBe(29);
    expect(run(inputs, { improvedRate: null, cohort: null, fallbackRate: 0.6, fallbackCohort: null }).controlSize).toBe(run().retested);
  });

  it("the lift parameter is positive for every segment and the binomial draw is exact at the ends", () => {
    for (const lift of Object.values(LIFT_BY_SEGMENT)) expect(lift).toBeGreaterThan(0);
    const rng = () => 0.5;
    expect(binomial(rng, 100, 0)).toBe(0);
    expect(binomial(rng, 100, 1)).toBe(100);
    expect(binomial(rng, 0, 0.5)).toBe(0);
  });
});
