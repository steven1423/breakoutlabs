import { describe, expect, it } from "vitest";
import { BRAND_RAMP_END, BRAND_RAMP_START, DEFAULTS, MEMBERSHIP_PRICE, PLAN_JOIN_RATE, PLAN_KIT_PRICE, PLAN_RETEST_RATE, brandRamp, brandRevenueIn, effectiveChurn, newCustomersIn, project, resolveRetestRate, type ModelInputs } from "@/lib/model/formulas";
import { parseInputs, serializeInputs } from "@/lib/model/url";

const at = (overrides: Partial<ModelInputs>): ModelInputs => ({ ...DEFAULTS, ...overrides });

describe("model formulas (§11)", () => {
  it("prices the kit and joins members by plan", () => {
    expect(PLAN_KIT_PRICE).toEqual({ standalone: 249, membership_first: 99, study: 149 });
    expect(PLAN_JOIN_RATE).toEqual({ standalone: 0.25, membership_first: 1, study: 1 });
    const month1 = project(at({ plan: "membership_first" })).rows[0];
    expect(month1.kitRevenue).toBe(800 * 99);
    expect(month1.members).toBe(800);
    expect(month1.membershipRevenue).toBe(800 * MEMBERSHIP_PRICE);
  });

  it("compounds new customers at the growth rate", () => {
    expect(newCustomersIn(1, DEFAULTS)).toBe(800);
    expect(newCustomersIn(13, DEFAULTS)).toBeCloseTo(800 * Math.pow(1.04, 12));
  });

  it("churn is zero for three months, then the rate on the share that has not retested", () => {
    expect(effectiveChurn(3, 0.08, 0.35)).toBe(0);
    expect(effectiveChurn(4, 0.08, 0.35)).toBeCloseTo(0.08 * 0.65);
    expect(effectiveChurn(4, 0.08, 0)).toBeCloseTo(0.08);
    const rows = project(at({ plan: "membership_first", growth: 0, retestRate: 0 })).rows;
    expect(rows[2].members).toBe(2400);
    expect(rows[3].members).toBeCloseTo(2400 * 0.92 + 800);
  });

  it("retest rate follows the plan unless overridden", () => {
    expect(resolveRetestRate({ plan: "standalone", retestRate: null })).toBe(PLAN_RETEST_RATE.standalone);
    expect(resolveRetestRate({ plan: "study", retestRate: null })).toBe(0.71);
    expect(resolveRetestRate({ plan: "study", retestRate: 0.3 })).toBe(0.3);
  });

  it("counts retests three months after the order", () => {
    const rows = project(at({ growth: 0, retestRate: 0.5 })).rows;
    expect(rows[2].retestedCum).toBe(0);
    expect(rows[3].retestedCum).toBe(400);
    expect(rows[5].retestedCum).toBe(1200);
  });

  it("brand revenue is zero before month 18, ramps to month 24, then follows §11 literally", () => {
    expect(brandRamp(BRAND_RAMP_START - 1)).toBe(0);
    expect(brandRamp(21)).toBeCloseTo(0.5);
    expect(brandRamp(BRAND_RAMP_END)).toBe(1);
    expect(brandRevenueIn(30, 12_000, DEFAULTS)).toBeCloseTo((12_000 / 12) * (120 / 12) * 0.15);
    expect(brandRevenueIn(10, 12_000, DEFAULTS)).toBe(0);
  });

  it("ARR is twelve times the month's revenue and valuation is ARR times the multiple", () => {
    const row = project(at({ multiple: 10 })).rows[11];
    expect(row.arr).toBeCloseTo(12 * (row.kitRevenue + row.membershipRevenue + row.brandRevenue));
    expect(row.valuation).toBeCloseTo(row.arr * 10);
  });

  it("dragging retest rate 30 → 60 raises the horizon valuation, and the multiple scales it linearly", () => {
    const low = project(at({ plan: "membership_first", retestRate: 0.3 })).horizon.valuation;
    const high = project(at({ plan: "membership_first", retestRate: 0.6 })).horizon.valuation;
    expect(high).toBeGreaterThan(low * 1.1);
    expect(project(at({ multiple: 24 })).horizon.valuation).toBeCloseTo(project(at({ multiple: 12 })).horizon.valuation * 2);
  });

  it("the horizon only changes how many rows there are", () => {
    const short = project(at({ horizon: 12 }));
    const long = project(at({ horizon: 36 }));
    expect(short.rows).toHaveLength(12);
    expect(long.rows).toHaveLength(36);
    expect(long.rows[11]).toEqual(short.rows[11]);
  });

  it("defaults at month 36 match the hand-checked figure", () => {
    const h = project(DEFAULTS).horizon;
    expect(h.newCustomers).toBeCloseTo(800 * Math.pow(1.04, 35), 6);
    expect(h.kitRevenue).toBeCloseTo(h.newCustomers * 249, 6);
    // Recomputed independently in plain Python (members 7,828; retested 11,653); a regression in any formula moves this.
    expect(Math.round(h.arr)).toBe(14_053_015);
    expect(Math.round(h.valuation)).toBe(168_636_176);
  });
});

describe("model URL state", () => {
  it("round-trips every input and leaves defaults out of the URL", () => {
    const inputs: ModelInputs = { newCustomers: 1200, growth: 0.06, plan: "membership_first", retestRate: 0.6, churn: 0.05, takeRate: 0.2, partnerGmvPerYear: 240, horizon: 48, multiple: 18 };
    const params = serializeInputs(inputs);
    expect(parseInputs(params)).toEqual(inputs);
    expect(serializeInputs(DEFAULTS).toString()).toBe("");
    expect(parseInputs(new URLSearchParams(""))).toEqual(DEFAULTS);
  });

  it("clamps out-of-range values and ignores junk", () => {
    const parsed = parseInputs(new URLSearchParams("n=999999&g=abc&plan=gold&r=5&x=1"));
    expect(parsed.newCustomers).toBe(5_000);
    expect(parsed.growth).toBe(DEFAULTS.growth);
    expect(parsed.plan).toBe("standalone");
    expect(parsed.retestRate).toBe(0.9);
    expect(parsed.multiple).toBe(6);
  });
});
