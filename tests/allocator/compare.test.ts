import { describe, expect, it } from "vitest";
import { expectedRetests, splitByFollowers, splitEven, type CampaignFacts } from "@/lib/allocator/compare";
import { betaInterval } from "@/lib/allocator/thompson";

const facts: CampaignFacts[] = [
  { campaignId: "big", orders: 40, retested: 3, spend: 6000, followers: 430_000 },
  { campaignId: "small", orders: 14, retested: 8, spend: 1400, followers: 61_000 },
  { campaignId: "new", orders: 0, retested: 0, spend: 0, followers: 9_000 },
];

describe("expectedRetests", () => {
  it("prices a split by each campaign's observed cost per order and posterior retest rate", () => {
    // big: $150 per order, posterior mean 4/42; small: $100 per order, posterior mean 9/16.
    const r = expectedRetests({ big: 1500, small: 1000 }, facts);
    expect(r).toBeCloseTo((1500 / 150) * (4 / 42) + (1000 / 100) * (9 / 16), 6);
  });

  it("gives nothing to a campaign with no orders yet", () => {
    expect(expectedRetests({ new: 5000 }, facts)).toBe(0);
  });

  it("buys more retests when the money follows retests rather than followers", () => {
    const byFollowers = splitByFollowers(10_000, facts);
    const bySmall = { big: 500, small: 9500, new: 0 };
    expect(expectedRetests(bySmall, facts)).toBeGreaterThan(expectedRetests(byFollowers, facts));
  });
});

describe("splits", () => {
  it("sum to the budget", () => {
    for (const split of [splitEven(10_000, facts), splitByFollowers(10_000, facts)]) {
      expect(Object.values(split).reduce((a, b) => a + b, 0)).toBeCloseTo(10_000, 6);
    }
  });

  it("weights by followers", () => {
    const s = splitByFollowers(10_000, facts);
    expect(s.big / s.small).toBeCloseTo(430 / 61, 6);
  });
});

describe("betaInterval", () => {
  it("is symmetric about a half for Beta(1,1) and covers the requested mass", () => {
    const [lo, hi] = betaInterval({ alpha: 1, beta: 1 }, 0.9);
    expect(lo).toBeCloseTo(0.05, 2);
    expect(hi).toBeCloseTo(0.95, 2);
  });

  it("narrows as evidence accumulates and sits around the mean", () => {
    const wide = betaInterval({ alpha: 4, beta: 38 });
    const narrow = betaInterval({ alpha: 40, beta: 380 });
    expect(narrow[1] - narrow[0]).toBeLessThan(wide[1] - wide[0]);
    expect(narrow[0]).toBeLessThan(40 / 420);
    expect(narrow[1]).toBeGreaterThan(40 / 420);
  });
});
