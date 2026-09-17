import { createServiceSupabase, type ServiceClient } from "../db/service.ts";
import { createInstagramSource, createYoutubeSource, dbSearchQuota, insertCrossLinks, recordEnrichError, upsertProfiles } from "./db.ts";
import type { CreatorProfile, CreatorStub } from "./types.ts";
import { DISCOVERY_QUERIES, QuotaExhaustedError, type YoutubeSource } from "./youtube.ts";

export type Collected = { profiles: CreatorProfile[]; crossLinks: CreatorStub[]; quotaExhausted: boolean };

/**
 * Runs every query with a per-query cap so each one contributes, keeps the first `limit` unique channels,
 * enriches them. Stops early, not empty, when quota runs out.
 */
export async function collectYoutube(source: YoutubeSource, limit: number, queries: readonly string[] = DISCOVERY_QUERIES): Promise<Collected> {
  const stubs = new Map<string, CreatorStub>();
  const perQuery = Math.max(5, Math.ceil(limit / queries.length));
  let quotaExhausted = false;
  for (const query of queries) {
    try {
      for (const stub of await source.discover(query, perQuery)) if (!stubs.has(stub.externalId!)) stubs.set(stub.externalId!, stub);
    } catch (err) {
      if (!(err instanceof QuotaExhaustedError)) throw err;
      quotaExhausted = true;
      break;
    }
  }
  const profiles = await source.enrichMany([...stubs.values()].slice(0, limit));
  return { profiles, crossLinks: profiles.flatMap((p) => p.crossLinks), quotaExhausted };
}

export type DiscoveryResult = {
  channels: number;
  added: number;
  updated: number;
  crossLinks: number;
  searchCallsUsed: number;
  searchCallsRemaining: number;
  quotaExhausted: boolean;
  /** Handles found this run, most followers first. The snapshot writer uses them. */
  handles: string[];
};

/** The Discover button, `pnpm discover` and the cron route all call this. */
export async function runDiscovery(limit = 40, db: ServiceClient = createServiceSupabase()): Promise<DiscoveryResult> {
  const source = createYoutubeSource(db);
  if (!source) throw new Error("Not configured: YOUTUBE_API_KEY");
  const collected = await collectYoutube(source, limit);
  const { added, updated } = await upsertProfiles(db, collected.profiles, "live");
  const crossLinks = await insertCrossLinks(db, collected.crossLinks);
  return {
    channels: collected.profiles.length,
    added,
    updated,
    crossLinks,
    searchCallsUsed: source.searchCalls,
    searchCallsRemaining: await dbSearchQuota(db).remaining(),
    quotaExhausted: collected.quotaExhausted,
    handles: [...collected.profiles].sort((a, b) => b.followers - a.followers).map((p) => p.handle),
  };
}

export type EnrichOutcome = { status: "live" | "seeded"; message: string };

/** Re-fetches one creator through the adapter for its platform. Failure keeps the row Seeded and stores why. */
export async function enrichCreator(creatorId: string, db: ServiceClient = createServiceSupabase()): Promise<EnrichOutcome> {
  const { data: creator, error } = await db.from("creators").select("id, platform, handle, url, external_id").eq("id", creatorId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!creator) throw new Error(`No creator ${creatorId}`);
  const stub: CreatorStub = { platform: creator.platform, handle: creator.handle, url: creator.url, source: "seeded", externalId: creator.external_id ?? undefined };

  try {
    const profile = await enrichWithAdapter(db, stub);
    await upsertProfiles(db, [profile], "live");
    return { status: "live", message: `Refreshed from ${profile.source}` };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Enrichment failed";
    await recordEnrichError(db, creatorId, message);
    return { status: "seeded", message };
  }
}

async function enrichWithAdapter(db: ServiceClient, stub: CreatorStub): Promise<CreatorProfile> {
  if (stub.platform === "youtube") {
    const source = createYoutubeSource(db);
    if (!source) throw new Error("Not configured: YOUTUBE_API_KEY");
    if (!stub.externalId) throw new Error("No YouTube channel id on this row");
    return source.enrich(stub);
  }
  if (stub.platform === "instagram") {
    const source = createInstagramSource(db);
    if (!source) throw new Error("Not configured: META_ACCESS_TOKEN, META_IG_USER_ID");
    return source.enrich(stub);
  }
  throw new Error("TikTok metrics: future adapter");
}

/** Sequential queue of Instagram enrichments (about 200 calls/hour allowed). Rows with a stored error are skipped. */
export async function enrichInstagramBatch(limit = 20, db: ServiceClient = createServiceSupabase()): Promise<{ attempted: number; live: number }> {
  if (!createInstagramSource(db)) throw new Error("Not configured: META_ACCESS_TOKEN, META_IG_USER_ID");
  const { data, error } = await db.from("creators").select("id").eq("platform", "instagram").eq("data_status", "seeded").is("enrich_error", null).limit(limit);
  if (error) throw new Error(error.message);
  let live = 0;
  for (const row of data) if ((await enrichCreator(row.id, db)).status === "live") live++;
  return { attempted: data.length, live };
}
