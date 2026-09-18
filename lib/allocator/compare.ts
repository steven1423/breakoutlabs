import { posteriorMean, type Evidence } from "./thompson.ts";

/**
 * What a budget split is expected to buy, so the page can say "this split versus an even split
 * versus paying by followers" in retests rather than in percentages.
 * Expected orders from a campaign = dollars ÷ its observed cost per order; expected retests =
 * expected orders × its posterior retest-per-order. Campaigns with no orders yet buy nothing.
 */

export type CampaignFacts = Evidence & { spend: number; followers: number | null };

export function expectedRetests(allocation: Record<string, number>, facts: readonly CampaignFacts[]): number {
  let total = 0;
  for (const f of facts) {
    const usd = allocation[f.campaignId] ?? 0;
    if (usd <= 0 || f.orders <= 0 || f.spend <= 0) continue;
    const costPerOrder = f.spend / f.orders;
    total += (usd / costPerOrder) * posteriorMean({ alpha: 1 + f.retested, beta: 1 + f.orders - f.retested });
  }
  return total;
}

/** The same budget split evenly. */
export function splitEven(budgetUsd: number, facts: readonly CampaignFacts[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const f of facts) out[f.campaignId] = facts.length ? budgetUsd / facts.length : 0;
  return out;
}

/** The same budget split in proportion to followers, which is how most creator budgets are actually set. */
export function splitByFollowers(budgetUsd: number, facts: readonly CampaignFacts[]): Record<string, number> {
  const total = facts.reduce((a, f) => a + (f.followers ?? 0), 0);
  const out: Record<string, number> = {};
  for (const f of facts) out[f.campaignId] = total > 0 ? (budgetUsd * (f.followers ?? 0)) / total : 0;
  return out;
}
