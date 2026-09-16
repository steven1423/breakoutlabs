import { describe, expect, it } from "vitest";
import { campaignMetrics, rankBy } from "@/lib/attribution/metrics";
import { STORY } from "@/lib/synthetic/creators";
import { dataset as loadDataset } from "../synthetic/helpers";

const dataset = loadDataset();

/** The seeded dataset through the real metrics: the toggle must flip the two story creators. */
function leaderboard() {
  const creators = new Map(dataset.creators.map((c) => [c.id, c]));
  return dataset.campaigns.map((campaign) => {
    const rows = dataset.attributions.filter((a) => a.campaign_id === campaign.id);
    const totals = { orders: rows.length, orderValue: rows.reduce((s, a) => s + Number(a.order_value), 0), registered: rows.filter((a) => a.kit_registered).length, retested: rows.filter((a) => a.retested).length, improved: rows.filter((a) => a.improved).length, spend: Number(campaign.spend_usd), membershipMonths90d: 0 };
    const creator = creators.get(campaign.creator_id)!;
    return { handle: creator.handle, followers: creator.followers ?? null, metrics: campaignMetrics(totals) };
  });
}

describe("leaderboard story (§12)", () => {
  it("the big creator leads by followers and the small one leads by cost-per-retest", () => {
    const rows = leaderboard();
    expect(rankBy(rows, "followers")[0].handle).toBe(STORY.big);
    expect(rankBy(rows, "cost_per_retest")[0].handle).toBe(STORY.small);
  });

  it("the seed carries the YouTube snapshot rows as Seeded, never Live", () => {
    for (const c of dataset.creators.filter((c) => c.platform === "youtube")) {
      expect(c.data_status).toBe("seeded");
      expect(c.source).toBe("youtube_api");
    }
  });
});
