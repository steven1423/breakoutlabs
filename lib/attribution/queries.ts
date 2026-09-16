import { createServiceSupabase, type ServiceClient } from "../db/service.ts";
import type { Database } from "../db/types.ts";
import { campaignMetrics, membershipMonthsWithin90d, type CampaignMetrics, type CampaignTotals } from "./metrics.ts";

type Platform = Database["public"]["Enums"]["platform"];
type DataStatus = Database["public"]["Enums"]["data_status"];

export type LeaderboardRow = {
  campaignId: string;
  code: string;
  spend: number;
  startAt: string;
  creator: { id: string; handle: string; platform: Platform; displayName: string | null; dataStatus: DataStatus };
  followers: number | null;
  totals: CampaignTotals;
  metrics: CampaignMetrics;
};

/** One row per campaign with the §8.7 metrics computed from the attribution rows. */
export async function loadLeaderboard(db: ServiceClient = createServiceSupabase()): Promise<LeaderboardRow[]> {
  const [campaigns, attributions] = await Promise.all([
    db.from("campaigns").select("id, code, spend_usd, start_at, status, creator:creators(id, handle, platform, display_name, followers, data_status)").eq("status", "active"),
    db.from("attributions").select("campaign_id, order_value, kit_registered, retested, improved, customer:customers(membership, membership_months)"),
  ]);
  if (campaigns.error) throw new Error(campaigns.error.message);
  if (attributions.error) throw new Error(attributions.error.message);

  const totals = new Map<string, CampaignTotals>();
  for (const a of attributions.data) {
    const t = totals.get(a.campaign_id) ?? { orders: 0, orderValue: 0, registered: 0, retested: 0, improved: 0, spend: 0, membershipMonths90d: 0 };
    t.orders++;
    t.orderValue += Number(a.order_value);
    if (a.kit_registered) t.registered++;
    if (a.retested) t.retested++;
    if (a.improved) t.improved++;
    if (a.customer && a.customer.membership !== "none") t.membershipMonths90d += membershipMonthsWithin90d(a.customer.membership_months);
    totals.set(a.campaign_id, t);
  }

  return campaigns.data
    .filter((c) => c.creator)
    .map((c) => {
      const t = { ...(totals.get(c.id) ?? { orders: 0, orderValue: 0, registered: 0, retested: 0, improved: 0, membershipMonths90d: 0 }), spend: Number(c.spend_usd) };
      return {
        campaignId: c.id,
        code: c.code,
        spend: Number(c.spend_usd),
        startAt: c.start_at,
        creator: { id: c.creator!.id, handle: c.creator!.handle, platform: c.creator!.platform, displayName: c.creator!.display_name, dataStatus: c.creator!.data_status },
        followers: c.creator!.followers,
        totals: t,
        metrics: campaignMetrics(t),
      };
    });
}
