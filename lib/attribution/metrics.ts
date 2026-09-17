/** Campaign metrics (CLAUDE.md §8.7). Pure; the query layer sums the rows, this file divides. */

export const MEMBERSHIP_PRICE = 49;

export type CampaignTotals = {
  orders: number;
  orderValue: number;
  registered: number;
  retested: number;
  improved: number;
  spend: number;
  /** Σ over attributed customers of their membership months inside the first 90 days (max 3 each). */
  membershipMonths90d: number;
};

export type CampaignMetrics = {
  cac: number | null;
  costPerRegistered: number | null;
  costPerRetest: number | null;
  retestRate: number | null;
  ltv90d: number;
};

/** A null metric means its denominator is zero; the UI shows a dash, never Infinity. */
export function campaignMetrics(t: CampaignTotals): CampaignMetrics {
  return {
    cac: divide(t.spend, t.orders),
    costPerRegistered: divide(t.spend, t.registered),
    costPerRetest: divide(t.spend, t.retested),
    retestRate: divide(t.retested, t.orders),
    ltv90d: t.orderValue + t.membershipMonths90d * MEMBERSHIP_PRICE,
  };
}

/** Months of membership that fall inside a customer's first 90 days. */
export function membershipMonthsWithin90d(membershipMonths: number): number {
  return Math.max(0, Math.min(3, membershipMonths));
}

function divide(numerator: number, denominator: number): number | null {
  return denominator > 0 ? numerator / denominator : null;
}

/** Orders a leaderboard. Null cost-per-retest (no retests yet) sorts last; followers sort high first. */
export function rankBy<T extends { followers: number | null; metrics: CampaignMetrics }>(rows: readonly T[], key: "followers" | "cost_per_retest"): T[] {
  const sorted = [...rows];
  if (key === "followers") return sorted.sort((a, b) => (b.followers ?? 0) - (a.followers ?? 0));
  return sorted.sort((a, b) => (a.metrics.costPerRetest ?? Infinity) - (b.metrics.costPerRetest ?? Infinity));
}
