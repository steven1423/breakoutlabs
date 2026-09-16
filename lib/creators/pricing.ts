/** Price-per-post estimate by follower tier, adjusted ±30% by engagement against the tier median (CLAUDE.md §8.6). */

export type Tier = "nano" | "micro" | "mid" | "macro";

export const TIER_BANDS: Record<Tier, { low: number; high: number }> = {
  nano: { low: 50, high: 200 },
  micro: { low: 200, high: 1_500 },
  mid: { low: 1_500, high: 8_000 },
  macro: { low: 8_000, high: 25_000 },
};

/** Typical engagement per tier: small accounts engage more. Estimates for pricing only. */
export const TIER_MEDIAN_ENGAGEMENT: Record<Tier, number> = { nano: 0.08, micro: 0.05, mid: 0.035, macro: 0.025 };

const MAX_ADJUSTMENT = 0.3;

export function tierFor(followers: number): Tier {
  if (followers < 10_000) return "nano";
  if (followers < 100_000) return "micro";
  if (followers < 500_000) return "mid";
  return "macro";
}

export type PriceBand = { tier: Tier; low: number; high: number; adjustment: number };

/** Engagement above the tier median raises the band, below lowers it, never by more than 30%. */
export function priceBand(followers: number, engagementRate: number | null): PriceBand {
  const tier = tierFor(Math.max(0, followers));
  const band = TIER_BANDS[tier];
  const median = TIER_MEDIAN_ENGAGEMENT[tier];
  const relative = engagementRate === null ? 0 : (engagementRate - median) / median;
  const adjustment = Math.max(-MAX_ADJUSTMENT, Math.min(MAX_ADJUSTMENT, relative * MAX_ADJUSTMENT));
  return {
    tier,
    low: roundTo10(band.low * (1 + adjustment)),
    high: roundTo10(band.high * (1 + adjustment)),
    adjustment,
  };
}

function roundTo10(value: number): number {
  return Math.max(0, Math.round(value / 10) * 10);
}
