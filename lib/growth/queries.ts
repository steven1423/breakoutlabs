import { loadLeaderboard, type LeaderboardRow } from "../attribution/queries.ts";
import { extractCrossLinks } from "../creators/crosslinks.ts";
import type { CreatorStub } from "../creators/types.ts";
import { createServiceSupabase } from "../db/service.ts";
import type { Database } from "../db/types.ts";

type Tables = Database["public"]["Tables"];
export type CreatorRow = Tables["creators"]["Row"];
export type CreatorCardRow = Tables["creator_cards"]["Row"];

export type CreatorListRow = Pick<CreatorRow, "id" | "platform" | "handle" | "display_name" | "followers" | "engagement_rate" | "avg_views" | "source" | "data_status" | "enriched_at" | "enrich_error"> & {
  fitScore: number | null;
};

/** Every creator row with its card's fit score, most followers first. */
export async function loadCreators(): Promise<CreatorListRow[]> {
  const db = createServiceSupabase();
  const { data, error } = await db
    .from("creators")
    .select("id, platform, handle, display_name, followers, engagement_rate, avg_views, source, data_status, enriched_at, enrich_error, card:creator_cards(fit_score)")
    .order("followers", { ascending: false, nullsFirst: false });
  if (error) throw new Error(error.message);
  return data.map(({ card, ...row }) => ({ ...row, fitScore: card?.fit_score ?? null }));
}

export type CrossLink = { stub: CreatorStub; creatorId: string | null };

export type CreatorDetail = {
  creator: CreatorRow;
  card: CreatorCardRow | null;
  campaigns: LeaderboardRow[];
  crossLinks: CrossLink[];
};

/** One creator with its card, campaign metrics and the handles named in its bio. Null when the id is unknown. */
export async function loadCreatorDetail(id: string): Promise<CreatorDetail | null> {
  const db = createServiceSupabase();
  const { data: creator, error } = await db.from("creators").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!creator) return null;

  const stubs = extractCrossLinks(creator.bio ?? "", "youtube_api");
  const [card, leaderboard, linked] = await Promise.all([
    db.from("creator_cards").select("*").eq("creator_id", id).maybeSingle(),
    loadLeaderboard(db),
    stubs.length ? db.from("creators").select("id, platform, handle").in("handle", stubs.map((s) => s.handle)) : Promise.resolve({ data: [], error: null }),
  ]);
  if (card.error) throw new Error(card.error.message);
  if (linked.error) throw new Error(linked.error.message);
  const byKey = new Map(linked.data.map((r) => [`${r.platform}:${r.handle.toLowerCase()}`, r.id]));

  return {
    creator,
    card: card.data,
    campaigns: leaderboard.filter((row) => row.creator.id === id),
    crossLinks: stubs.map((stub) => ({ stub, creatorId: byKey.get(`${stub.platform}:${stub.handle.toLowerCase()}`) ?? null })),
  };
}

export function formatUsd(value: number | null, digits = 0): string {
  if (value === null || !Number.isFinite(value)) return "–";
  return value.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: digits, minimumFractionDigits: digits });
}

export function formatCount(value: number | null): string {
  if (value === null) return "–";
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 10_000) return `${Math.round(value / 1_000)}K`;
  return value.toLocaleString("en-US");
}

export function formatPercent(value: number | null): string {
  return value === null ? "–" : `${Math.round(value * 100)}%`;
}
