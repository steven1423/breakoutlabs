import { describe, expect, it } from "vitest";
import { pageOf, parsePage, withParams } from "@/lib/ui/paging";

describe("pageOf", () => {
  const rows = Array.from({ length: 53 }, (_, i) => i + 1);

  it("slices 25 at a time and reports the range", () => {
    const p = pageOf(rows, 2);
    expect(p.rows[0]).toBe(26);
    expect(p.rows.length).toBe(25);
    expect([p.from, p.to, p.total, p.pages]).toEqual([26, 50, 53, 3]);
  });

  it("clamps a page past the end to the last page and a page below one to the first", () => {
    expect(pageOf(rows, 99).page).toBe(3);
    expect(pageOf(rows, 99).rows).toEqual([51, 52, 53]);
    expect(pageOf(rows, -4).page).toBe(1);
  });

  it("handles an empty list without a page zero", () => {
    const p = pageOf([], 1);
    expect([p.rows.length, p.page, p.pages, p.from, p.to]).toEqual([0, 1, 1, 0, 0]);
  });
});

describe("parsePage", () => {
  it("accepts a positive integer and nothing else", () => {
    expect(parsePage("3")).toBe(3);
    expect(parsePage(["2", "9"])).toBe(2);
    for (const bad of [undefined, "", "0", "-1", "1.5", "two"]) expect(parsePage(bad)).toBe(1);
  });
});

describe("withParams", () => {
  it("keeps the other parameters and drops a key set to null", () => {
    expect(withParams({ as: "support", view: "stuck", page: "3" }, { page: null })).toBe("?as=support&view=stuck");
    expect(withParams({ as: "support" }, { view: "tickets", page: 2 })).toBe("?as=support&view=tickets&page=2");
    expect(withParams({}, { page: null })).toBe("");
  });
});
