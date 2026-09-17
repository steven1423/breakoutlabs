import seedrandom from "seedrandom";
import { describe, expect, it } from "vitest";
import { CAP, FLOOR, allocate, betaPdf, clampShares, posteriorFor, posteriorMean, sampleBeta } from "@/lib/allocator/thompson";

const evidence = [
  { campaignId: "big", orders: 40, retested: 3 },
  { campaignId: "small", orders: 16, retested: 10 },
  { campaignId: "new", orders: 0, retested: 0 },
  { campaignId: "mid", orders: 12, retested: 4 },
];

describe("Thompson allocator (§8.8)", () => {
  it("posterior is Beta(1 + retested, 1 + orders − retested) with a uniform prior for a new campaign", () => {
    expect(posteriorFor({ campaignId: "x", orders: 16, retested: 10 })).toEqual({ alpha: 11, beta: 7 });
    expect(posteriorFor({ campaignId: "x", orders: 0, retested: 0 })).toEqual({ alpha: 1, beta: 1 });
    expect(posteriorMean({ alpha: 11, beta: 7 })).toBeCloseTo(11 / 18);
  });

  it("more observed retests move the posterior mean up", () => {
    const before = posteriorMean(posteriorFor({ campaignId: "x", orders: 10, retested: 2 }));
    const after = posteriorMean(posteriorFor({ campaignId: "x", orders: 14, retested: 6 }));
    expect(after).toBeGreaterThan(before);
  });

  it("allocations sum to the budget to the cent and respect the floor and cap", () => {
    for (const seed of ["a", "b", "c", "d", "e"]) {
      const { allocation } = allocate(10_000, evidence, seedrandom(seed));
      const total = Object.values(allocation).reduce((a, b) => a + b, 0);
      expect(Math.round(total * 100)).toBe(1_000_000);
      for (const usd of Object.values(allocation)) {
        expect(usd).toBeGreaterThanOrEqual(10_000 * FLOOR - 0.01);
        expect(usd).toBeLessThanOrEqual(10_000 * CAP + 0.01);
      }
    }
  });

  it("is deterministic under a seeded RNG and differs under another seed", () => {
    const one = allocate(5_000, evidence, seedrandom("week-38"));
    const same = allocate(5_000, evidence, seedrandom("week-38"));
    const other = allocate(5_000, evidence, seedrandom("week-39"));
    expect(same).toEqual(one);
    expect(other.posterior.big.sampled).not.toBe(one.posterior.big.sampled);
  });

  it("over many draws the strong campaign gets the most budget", () => {
    const sums: Record<string, number> = {};
    for (let i = 0; i < 200; i++) {
      const { allocation } = allocate(1_000, evidence, seedrandom(`run-${i}`));
      for (const [id, usd] of Object.entries(allocation)) sums[id] = (sums[id] ?? 0) + usd;
    }
    expect(sums.small).toBeGreaterThan(sums.big);
    expect(sums.small).toBeGreaterThan(sums.mid);
  });

  it("clampShares pins extremes and redistributes the rest", () => {
    const near = (xs: number[]) => xs.map((x) => Number(x.toFixed(6)));
    expect(near(clampShares([0.9, 0.05, 0.05], FLOOR, CAP))).toEqual([0.4, 0.3, 0.3]);
    // Two campaigns at the cap leave 20% for the weak one: above its floor, because the budget must be spent.
    expect(near(clampShares([0.001, 0.5, 0.5], FLOOR, CAP))).toEqual([0.2, 0.4, 0.4]);
    expect(near(clampShares([1, 1, 1, 1], FLOOR, CAP))).toEqual([0.25, 0.25, 0.25, 0.25]);
    expect(() => clampShares(new Array(30).fill(1), FLOOR, CAP)).toThrow(/cannot both hold/);
  });

  it("sampleBeta stays inside (0, 1) and the density integrates to about 1", () => {
    const rng = seedrandom("beta");
    for (let i = 0; i < 100; i++) {
      const x = sampleBeta(rng, 2.5, 4);
      expect(x).toBeGreaterThan(0);
      expect(x).toBeLessThan(1);
    }
    let area = 0;
    for (let i = 1; i < 1000; i++) area += betaPdf(i / 1000, 3, 5) / 1000;
    expect(area).toBeCloseTo(1, 1);
  });
});
