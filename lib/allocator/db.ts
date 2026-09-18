import seedrandom from "seedrandom";
import { createServiceSupabase, type ServiceClient } from "../db/service.ts";
import type { Database } from "../db/types.ts";
import { allocate, type Evidence, type Sampled } from "./thompson.ts";

type RunRow = Database["public"]["Tables"]["allocator_runs"]["Row"];

export type AllocatorRun = { id: string; runAt: string; budgetUsd: number; posterior: Record<string, Sampled>; allocation: Record<string, number> };

/** ISO week label, e.g. 2026-W38. The weekly run is seeded by it so re-running in the same week reproduces the draw. */
export function isoWeek(date: Date): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = Date.UTC(d.getUTCFullYear(), 0, 1);
  const week = Math.ceil(((d.getTime() - yearStart) / 86_400_000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

/** Posteriors from the attribution rows, one allocation, persisted to allocator_runs. */
export async function runAllocator(budgetUsd: number, seed: string = `allocator-${isoWeek(new Date())}`, db: ServiceClient = createServiceSupabase()): Promise<AllocatorRun> {
  if (!(budgetUsd > 0)) throw new Error("Budget must be a positive number of dollars");
  const evidence = await loadEvidence(db);
  if (evidence.length === 0) throw new Error("No active campaigns to allocate over");
  const result = allocate(budgetUsd, evidence, seedrandom(seed));
  const { data, error } = await db
    .from("allocator_runs")
    .insert({ budget_usd: budgetUsd, posterior: result.posterior, allocation: result.allocation })
    .select("id, run_at, budget_usd, posterior, allocation")
    .single();
  if (error) throw new Error(error.message);
  return toRun(data);
}

export async function loadEvidence(db: ServiceClient): Promise<Evidence[]> {
  const [campaigns, attributions] = await Promise.all([
    db.from("campaigns").select("id").eq("status", "active"),
    db.from("attributions").select("campaign_id, retested"),
  ]);
  if (campaigns.error) throw new Error(campaigns.error.message);
  if (attributions.error) throw new Error(attributions.error.message);
  const counts = new Map(campaigns.data.map((c) => [c.id, { orders: 0, retested: 0 }]));
  for (const a of attributions.data) {
    const c = counts.get(a.campaign_id);
    if (!c) continue;
    c.orders++;
    if (a.retested) c.retested++;
  }
  return [...counts.entries()].map(([campaignId, c]) => ({ campaignId, ...c }));
}

export type CampaignInfo = { code: string; handle: string; platform: string; orders: number; retested: number; spend: number; followers: number | null };
export type AllocatorView = { latest: AllocatorRun | null; previous: AllocatorRun | null; campaigns: Record<string, CampaignInfo> };

/** The last two runs plus what each campaign has shown so far, for the page's comparisons. */
export async function loadAllocatorView(db: ServiceClient = createServiceSupabase()): Promise<AllocatorView> {
  const [runs, campaigns, attributions] = await Promise.all([
    db.from("allocator_runs").select("id, run_at, budget_usd, posterior, allocation").order("run_at", { ascending: false }).limit(2),
    db.from("campaigns").select("id, code, spend_usd, creator:creators(handle, platform, followers)"),
    db.from("attributions").select("campaign_id, retested"),
  ]);
  if (runs.error) throw new Error(runs.error.message);
  if (campaigns.error) throw new Error(campaigns.error.message);
  if (attributions.error) throw new Error(attributions.error.message);
  const map: AllocatorView["campaigns"] = {};
  for (const c of campaigns.data) {
    map[c.id] = { code: c.code, handle: c.creator?.handle ?? "unknown", platform: c.creator?.platform ?? "", orders: 0, retested: 0, spend: Number(c.spend_usd), followers: c.creator?.followers ?? null };
  }
  for (const a of attributions.data) {
    const c = map[a.campaign_id];
    if (!c) continue;
    c.orders++;
    if (a.retested) c.retested++;
  }
  return { latest: runs.data[0] ? toRun(runs.data[0]) : null, previous: runs.data[1] ? toRun(runs.data[1]) : null, campaigns: map };
}

function toRun(row: Pick<RunRow, "id" | "run_at" | "budget_usd" | "posterior" | "allocation">): AllocatorRun {
  return { id: row.id, runAt: row.run_at, budgetUsd: Number(row.budget_usd), posterior: row.posterior as Record<string, Sampled>, allocation: row.allocation as Record<string, number> };
}
