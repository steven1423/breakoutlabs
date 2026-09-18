import { describe, expect, it } from "vitest";
import { DEFAULTS, PLANS, project, sensitivity, yearSummary } from "@/lib/model/formulas";

describe("sensitivity", () => {
  it("returns one valuation per plan per rate, rising with the retest rate for every plan", () => {
    const rows = sensitivity(DEFAULTS, [0.2, 0.4, 0.6, 0.8]);
    expect(rows.length).toBe(4);
    for (const plan of PLANS) {
      for (let i = 1; i < rows.length; i++) expect(rows[i].byPlan[plan]).toBeGreaterThan(rows[i - 1].byPlan[plan]);
    }
  });

  it("matches a direct projection at the same rate", () => {
    const [row] = sensitivity(DEFAULTS, [0.5]);
    expect(row.byPlan.study).toBeCloseTo(project({ ...DEFAULTS, plan: "study", retestRate: 0.5 }).horizon.valuation, 6);
  });
});

describe("yearSummary", () => {
  it("gives three rows for a 36-month horizon and sums new customers by year", () => {
    const p = project(DEFAULTS);
    const years = yearSummary(p);
    expect(years.map((y) => y.endMonth)).toEqual([12, 24, 36]);
    expect(years[0].newCustomers).toBeCloseTo(p.rows.slice(0, 12).reduce((a, r) => a + r.newCustomers, 0), 6);
    expect(years[2].valuation).toBe(p.horizon.valuation);
  });

  it("drops a partial year", () => {
    expect(yearSummary(project({ ...DEFAULTS, horizon: 30 })).length).toBe(2);
  });
});
