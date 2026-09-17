import { describe, expect, it } from "vitest";
import { guardedAggregate, normaliseMinCohort, type ResearchRow } from "@/lib/intelligence/guard";

function row(over: Partial<ResearchRow>): ResearchRow {
  return { consent_research: true, segment: "androgen", region_state: "FL", age_band: "25-34", sex: "female", month: "2026-01", plan: "standalone", channel: "instagram", retested: false, improved: null, deltas: {}, interventionTypes: [], ...over };
}

const rows: ResearchRow[] = [
  ...Array.from({ length: 15 }, () => row({ region_state: "FL", segment: "androgen", retested: true, improved: true, deltas: { insulin: 2 }, interventionTypes: ["supplement"] })),
  ...Array.from({ length: 8 }, () => row({ region_state: "FL", segment: "insulin" })),
  ...Array.from({ length: 12 }, () => row({ region_state: "TX", segment: "cortisol", retested: true, improved: false, deltas: { insulin: -1 } })),
  ...Array.from({ length: 5 }, () => row({ region_state: "GA" })),
  ...Array.from({ length: 30 }, () => row({ region_state: "NY", consent_research: false })),
];

describe("guardedAggregate (§9)", () => {
  it("counts only consenting rows and suppresses cells below the minimum cohort", () => {
    const r = guardedAggregate(rows, { dimensions: ["region_state"], measure: "count" }, 10);
    expect(r.consented).toBe(40);
    expect(r.total).toBe(70);
    const by = Object.fromEntries(r.cells.map((c) => [c.dims.region_state, c]));
    expect(by.FL).toMatchObject({ suppressed: false, count: 23, value: 23 });
    expect(by.TX).toMatchObject({ suppressed: false, count: 12 });
    expect(by.GA).toEqual({ dims: { region_state: "GA" }, suppressed: true, count: null, value: null });
    expect(by.NY).toBeUndefined();
  });

  it("a cell exactly at the threshold passes; raising the threshold makes it disappear", () => {
    const at12 = guardedAggregate(rows, { dimensions: ["region_state"], measure: "count" }, 12);
    expect(at12.cells.find((c) => c.dims.region_state === "TX")?.suppressed).toBe(false);
    const at13 = guardedAggregate(rows, { dimensions: ["region_state"], measure: "count" }, 13);
    expect(at13.cells.find((c) => c.dims.region_state === "TX")?.suppressed).toBe(true);
    expect(guardedAggregate(rows, { dimensions: ["region_state"], measure: "count" }, 50).cells.every((c) => c.suppressed)).toBe(true);
  });

  it("share is relative to the parent group and leading_segment names the biggest segment", () => {
    const share = guardedAggregate(rows, { dimensions: ["region_state", "segment"], measure: "share" }, 5);
    const fl = share.cells.filter((c) => c.dims.region_state === "FL");
    expect(fl.find((c) => c.dims.segment === "androgen")).toMatchObject({ value: 15 / 23 });
    const lead = guardedAggregate(rows, { dimensions: ["region_state"], measure: "leading_segment" }, 10);
    expect(lead.cells.find((c) => c.dims.region_state === "FL")).toMatchObject({ label: "androgen", value: 15 / 23 });
  });

  it("rates and marker deltas count only contributing rows, and the minimum applies to those", () => {
    const retest = guardedAggregate(rows, { dimensions: ["region_state"], measure: "retest_rate" }, 10);
    expect(retest.cells.find((c) => c.dims.region_state === "FL")?.value).toBeCloseTo(15 / 23);
    const improved = guardedAggregate(rows, { dimensions: ["region_state"], measure: "improved_rate" }, 10);
    expect(improved.cells.find((c) => c.dims.region_state === "FL")).toMatchObject({ count: 15, value: 1 });
    const delta = guardedAggregate(rows, { dimensions: [], measure: "marker_delta", marker: "insulin", filter: { interventionType: "supplement" } }, 10);
    expect(delta.cells).toEqual([{ dims: {}, suppressed: false, count: 15, value: 2 }]);
    const tooFew = guardedAggregate(rows, { dimensions: [], measure: "marker_delta", marker: "insulin", filter: { interventionType: "supplement" } }, 16);
    expect(tooFew.cells[0].suppressed).toBe(true);
  });

  it("never emits anything but dimension values, a count, a value and a label", () => {
    const r = guardedAggregate(rows, { dimensions: ["region_state", "segment"], measure: "retest_rate" }, 2);
    for (const c of r.cells) {
      expect(Object.keys(c).sort()).toEqual(c.suppressed ? ["count", "dims", "suppressed", "value"] : expect.arrayContaining(["count", "dims", "suppressed", "value"]));
      expect(Object.keys(c)).not.toContain("rows");
      expect(JSON.stringify(c)).not.toMatch(/email|first_name|customer_id/);
    }
  });

  it("normalises the setting: junk falls back, and a cohort of one is never allowed", () => {
    expect(normaliseMinCohort("abc")).toBe(50);
    expect(normaliseMinCohort(1)).toBe(2);
    expect(normaliseMinCohort("25")).toBe(25);
    expect(normaliseMinCohort(9_999)).toBe(500);
  });
});
