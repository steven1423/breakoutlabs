import { describe, expect, it } from "vitest";
import { STORY } from "@/lib/synthetic/creators";
import { RETEST_RATE } from "@/lib/synthetic/constants";
import { dataset } from "./helpers";

describe("attribution story (CLAUDE.md §12)", () => {
  const d = dataset();
  const stats = (handle: string) => {
    const creator = d.creators.find((c) => c.handle === handle)!;
    const campaign = d.campaigns.find((c) => c.creator_id === creator.id)!;
    const rows = d.attributions.filter((a) => a.campaign_id === campaign.id);
    const retested = rows.filter((a) => a.retested).length;
    return { followers: creator.followers!, orders: rows.length, retested, rate: retested / rows.length, costPerRetest: Number(campaign.spend_usd) / Math.max(1, retested) };
  };

  it("big creator: 300–500K followers, strong orders, retest rate under 10%", () => {
    const big = stats(STORY.big);
    expect(big.followers).toBeGreaterThanOrEqual(300_000);
    expect(big.followers).toBeLessThanOrEqual(500_000);
    expect(big.orders).toBeGreaterThan(25);
    expect(big.rate).toBeLessThan(0.1);
  });

  it("small creator: 40–80K followers, fewer orders, retest rate over 50%", () => {
    const small = stats(STORY.small);
    const big = stats(STORY.big);
    expect(small.followers).toBeGreaterThanOrEqual(40_000);
    expect(small.followers).toBeLessThanOrEqual(80_000);
    expect(small.orders).toBeLessThan(big.orders);
    expect(small.rate).toBeGreaterThan(0.5);
  });

  it("ranking by followers and by cost-per-retest flips their order", () => {
    const big = stats(STORY.big);
    const small = stats(STORY.small);
    expect(big.followers).toBeGreaterThan(small.followers);
    expect(small.costPerRetest).toBeLessThan(big.costPerRetest);
  });

  it("has 15 campaigns with spend in the $300–6,000 range and consistent attribution rows", () => {
    expect(d.campaigns.length).toBe(15);
    for (const c of d.campaigns) {
      expect(Number(c.spend_usd)).toBeGreaterThanOrEqual(300);
      expect(Number(c.spend_usd)).toBeLessThanOrEqual(6000);
    }
    const codeById = new Map(d.campaigns.map((c) => [c.id, c.code]));
    for (const a of d.attributions) {
      const customer = d.customers.find((c) => c.id === a.customer_id)!;
      expect(customer.creator_code).toBe(codeById.get(a.campaign_id));
      expect(a.order_at).toBe(customer.created_at);
    }
  });

  it("retest rates by plan among eligible customers follow §12", () => {
    const retestedIds = new Set(d.panels.filter((p) => p.sequence_no === 2).map((p) => p.customer_id));
    const eligibleAge = 160 * 24 * 3_600_000;
    for (const plan of ["standalone", "membership_first", "study"] as const) {
      const eligible = d.customers.filter((c) => c.plan === plan && Date.parse(c.created_at) <= Date.UTC(2026, 8, 16, 12) - eligibleAge);
      const rate = eligible.filter((c) => retestedIds.has(c.id)).length / eligible.length;
      expect(Math.abs(rate - RETEST_RATE[plan]), `${plan} ${rate.toFixed(2)} (n=${eligible.length})`).toBeLessThan(0.15);
    }
  });
});
