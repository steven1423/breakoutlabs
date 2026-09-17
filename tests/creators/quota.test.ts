import { describe, expect, it } from "vitest";
import { DAILY_SEARCH_CALLS, parseQuota, remainingSearchCalls, takeSearchCall } from "@/lib/creators/quota";

const day1 = new Date("2026-09-16T10:00:00Z");
const day2 = new Date("2026-09-17T00:00:01Z");

describe("YouTube search quota", () => {
  it("counts up within a day and refuses the 61st call", () => {
    let state = parseQuota(null);
    for (let i = 0; i < DAILY_SEARCH_CALLS; i++) {
      const step = takeSearchCall(state, day1);
      expect(step.allowed).toBe(true);
      state = step.state;
    }
    expect(state).toEqual({ date: "2026-09-16", search_calls: 60 });
    expect(takeSearchCall(state, day1).allowed).toBe(false);
    expect(remainingSearchCalls(state, day1)).toBe(0);
  });

  it("resets on a new UTC date", () => {
    const spent = { date: "2026-09-16", search_calls: 60 };
    expect(remainingSearchCalls(spent, day2)).toBe(60);
    expect(takeSearchCall(spent, day2)).toEqual({ state: { date: "2026-09-17", search_calls: 1 }, allowed: true });
  });

  it("parses junk settings as a fresh counter", () => {
    expect(parseQuota("nope")).toEqual({ date: "", search_calls: 0 });
    expect(parseQuota({ date: 3, search_calls: "x" })).toEqual({ date: "", search_calls: 0 });
  });
});
