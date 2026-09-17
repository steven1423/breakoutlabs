import { describe, expect, it } from "vitest";
import { TIER_BANDS, TIER_MEDIAN_ENGAGEMENT, priceBand, tierFor } from "@/lib/creators/pricing";

describe("pricing", () => {
  it("tiers at the §8.6 boundaries", () => {
    expect(tierFor(0)).toBe("nano");
    expect(tierFor(9_999)).toBe("nano");
    expect(tierFor(10_000)).toBe("micro");
    expect(tierFor(99_999)).toBe("micro");
    expect(tierFor(100_000)).toBe("mid");
    expect(tierFor(499_999)).toBe("mid");
    expect(tierFor(500_000)).toBe("macro");
  });

  it("median engagement gives the plain tier band", () => {
    const band = priceBand(50_000, TIER_MEDIAN_ENGAGEMENT.micro);
    expect(band).toMatchObject({ tier: "micro", low: TIER_BANDS.micro.low, high: TIER_BANDS.micro.high, adjustment: 0 });
  });

  it("adjusts by at most ±30% however extreme the engagement", () => {
    const hot = priceBand(50_000, 0.5);
    expect(hot.adjustment).toBe(0.3);
    expect(hot.high).toBe(Math.round((TIER_BANDS.micro.high * 1.3) / 10) * 10);
    const cold = priceBand(50_000, 0);
    expect(cold.adjustment).toBe(-0.3);
    expect(cold.low).toBe(Math.round((TIER_BANDS.micro.low * 0.7) / 10) * 10);
  });

  it("unknown engagement means no adjustment, and nothing goes below zero", () => {
    expect(priceBand(2_000, null)).toMatchObject({ tier: "nano", adjustment: 0, low: 50, high: 200 });
    expect(priceBand(-5, -1).low).toBeGreaterThanOrEqual(0);
  });
});
