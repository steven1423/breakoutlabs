import { describe, expect, it } from "vitest";
import { LIFT_BY_SEGMENT, binomial, simulate, type Baseline, type BrandInputs } from "@/lib/brand/simulate";

const inputs: BrandInputs = { segment: "insulin", ageBand: "25-34", budgetUsd: 20_000, windowDays: 90 };
const baseline: Baseline = { improvedRate: 0.55, cohort: 40, fallbackRate: 0.5 };

describe("brand simulation (§10)", () => {
  it("is deterministic for the same inputs and differs for different ones", () => {
    expect(simulate(inputs, baseline)).toEqual(simulate(inputs, baseline));
    expect(simulate({ ...inputs, budgetUsd: 25_000 }, baseline)).not.toEqual(simulate(inputs, baseline));
  });

  it("follows the funnel: exposures ≥ purchases ≥ registered ≥ retested ≥ improved, and a bigger budget exposes more", () => {
    const s = simulate(inputs, baseline);
    expect(s.exposures).toBeGreaterThanOrEqual(s.purchases);
    expect(s.purchases).toBeGreaterThanOrEqual(s.registered);
    expect(s.registered).toBeGreaterThanOrEqual(s.retested);
    expect(s.retested).toBeGreaterThanOrEqual(s.treatedImproved);
    expect(simulate({ ...inputs, budgetUsd: 40_000 }, baseline).exposures).toBe(2 * s.exposures);
  });

  it("reports the treated rate, the control rate, the lift and both sample sizes", () => {
    const s = simulate(inputs, baseline);
    expect(s.retested).toBeGreaterThan(30);
    expect(s.controlSize).toBeGreaterThanOrEqual(s.retested);
    expect(s.treatedRate).not.toBeNull();
    expect(s.liftPoints).toBeCloseTo(s.treatedRate! - s.controlRate, 10);
    expect(s.baselineFromGuard).toBe(true);
    expect(s.costPerRetest).toBeCloseTo(20_000 / s.retested);
  });

  it("falls back to the all-segment rate when the guarded baseline is suppressed, and says so", () => {
    const s = simulate(inputs, { improvedRate: null, cohort: null, fallbackRate: 0.5 });
    expect(s.baselineFromGuard).toBe(false);
    expect(s.controlSize).toBe(s.retested);
  });

  it("the lift parameter is positive for every segment and the binomial draw is exact at the ends", () => {
    for (const lift of Object.values(LIFT_BY_SEGMENT)) expect(lift).toBeGreaterThan(0);
    const rng = () => 0.5;
    expect(binomial(rng, 100, 0)).toBe(0);
    expect(binomial(rng, 100, 1)).toBe(100);
    expect(binomial(rng, 0, 0.5)).toBe(0);
  });
});
