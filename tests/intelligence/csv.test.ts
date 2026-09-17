import { describe, expect, it } from "vitest";
import { cellsToCsv } from "@/lib/intelligence/csv";
import { towardOptimal } from "@/lib/intelligence/queries";

describe("aggregate CSV", () => {
  it("writes one line per cell and prints suppressed for hidden cells", () => {
    const csv = cellsToCsv(
      [
        { dims: { region_state: "FL", segment: "androgen" }, suppressed: false, count: 23, value: 0.6522, label: "androgen" },
        { dims: { region_state: "GA", segment: "mixed" }, suppressed: true, count: null, value: null },
      ],
      ["region_state", "segment"],
    );
    expect(csv).toBe("region_state,segment,count,value,label\nFL,androgen,23,0.6522,androgen\nGA,mixed,suppressed,suppressed,\n");
  });

  it("only ever has dimension, count, value and label columns", () => {
    const header = cellsToCsv([], ["segment", "age_band"]).trim();
    expect(header).toBe("segment,age_band,count,value,label");
  });
});

describe("towardOptimal", () => {
  it("is positive when a high marker falls, a low marker rises, or an in-range marker moves toward the midpoint", () => {
    expect(towardOptimal(30, 22, 6, 23)).toBe(8);
    expect(towardOptimal(19, 40, 30, 100)).toBe(21);
    expect(towardOptimal(20, 15, 6, 23)).toBeCloseTo(5.5 - 0.5);
    expect(towardOptimal(30, 35, 6, 23)).toBe(-5);
  });
});
