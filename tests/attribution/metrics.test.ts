import { describe, expect, it } from "vitest";
import { campaignMetrics, membershipMonthsWithin90d, rankBy } from "@/lib/attribution/metrics";

describe("campaign metrics (§8.7)", () => {
  it("computes the five formulas on a worked example", () => {
    const m = campaignMetrics({ orders: 40, orderValue: 40 * 249, registered: 32, retested: 3, improved: 2, spend: 5_800, membershipMonths90d: 6 });
    expect(m.cac).toBeCloseTo(145);
    expect(m.costPerRegistered).toBeCloseTo(181.25);
    expect(m.costPerRetest).toBeCloseTo(1_933.33, 2);
    expect(m.retestRate).toBeCloseTo(0.075);
    expect(m.ltv90d).toBe(40 * 249 + 6 * 49);
  });

  it("never divides by zero", () => {
    const m = campaignMetrics({ orders: 0, orderValue: 0, registered: 0, retested: 0, improved: 0, spend: 300, membershipMonths90d: 0 });
    expect(m).toEqual({ cac: null, costPerRegistered: null, costPerRetest: null, retestRate: null, ltv90d: 0 });
  });

  it("counts at most three membership months inside 90 days", () => {
    expect(membershipMonthsWithin90d(0)).toBe(0);
    expect(membershipMonthsWithin90d(2)).toBe(2);
    expect(membershipMonthsWithin90d(11)).toBe(3);
  });

  it("ranks by followers descending and by cost-per-retest ascending with nulls last", () => {
    const rows = [
      { id: "a", followers: 430_000, metrics: campaignMetrics({ orders: 40, orderValue: 0, registered: 0, retested: 3, improved: 0, spend: 5_800, membershipMonths90d: 0 }) },
      { id: "b", followers: 61_000, metrics: campaignMetrics({ orders: 16, orderValue: 0, registered: 0, retested: 10, improved: 0, spend: 1_400, membershipMonths90d: 0 }) },
      { id: "c", followers: 9_000, metrics: campaignMetrics({ orders: 2, orderValue: 0, registered: 0, retested: 0, improved: 0, spend: 300, membershipMonths90d: 0 }) },
    ];
    expect(rankBy(rows, "followers").map((r) => r.id)).toEqual(["a", "b", "c"]);
    expect(rankBy(rows, "cost_per_retest").map((r) => r.id)).toEqual(["b", "a", "c"]);
  });
});
