import type { ServiceClient } from "../db/service.ts";
import type { Database, Json } from "../db/types.ts";
import { isConfigured } from "../env.ts";
import { redactPayload } from "./crosslinks.ts";
import { InstagramSource } from "./instagram.ts";
import { parseQuota, remainingSearchCalls, takeSearchCall, type QuotaState } from "./quota.ts";
import { SearchSource } from "./search.ts";
import { fetchJson, type CreatorProfile, type CreatorStub, type ResponseCache } from "./types.ts";
import { YoutubeSource } from "./youtube.ts";

type CreatorInsert = Database["public"]["Tables"]["creators"]["Insert"];
type DataStatus = Database["public"]["Enums"]["data_status"];

/** api_cache (migration 0007): one row per request key. */
export function dbCache(db: ServiceClient): ResponseCache {
  return {
    async get(key, maxAgeMs) {
      const { data, error } = await db.from("api_cache").select("payload, fetched_at").eq("key", key).maybeSingle();
      if (error) throw new Error(error.message);
      if (!data || Date.now() - Date.parse(data.fetched_at) > maxAgeMs) return null;
      return { payload: data.payload, fetchedAt: data.fetched_at };
    },
    async set(key, payload) {
      // Redacted before it is stored: the raw responses carry creators' business emails and phone numbers.
      const { error } = await db.from("api_cache").upsert({ key, payload: redactPayload(payload) as Json, fetched_at: new Date().toISOString() });
      if (error) throw new Error(error.message);
    },
  };
}

/** The daily search counter lives in settings.youtube_quota so every server instance shares it. */
export function dbSearchQuota(db: ServiceClient, now: () => Date = () => new Date()) {
  const load = async (): Promise<QuotaState> => {
    const { data, error } = await db.from("settings").select("value").eq("key", "youtube_quota").maybeSingle();
    if (error) throw new Error(error.message);
    return parseQuota(data?.value);
  };
  return {
    async take(): Promise<boolean> {
      const next = takeSearchCall(await load(), now());
      const { error } = await db.from("settings").upsert({ key: "youtube_quota", value: next.state });
      if (error) throw new Error(error.message);
      return next.allowed;
    },
    async remaining(): Promise<number> {
      return remainingSearchCalls(await load(), now());
    },
  };
}

export function createYoutubeSource(db: ServiceClient): YoutubeSource | null {
  if (!isConfigured("youtube")) return null;
  return new YoutubeSource({ apiKey: process.env.YOUTUBE_API_KEY!, fetchJson, cache: dbCache(db), takeSearchCall: dbSearchQuota(db).take });
}

export function createInstagramSource(db: ServiceClient): InstagramSource | null {
  if (!isConfigured("meta")) return null;
  return new InstagramSource({ token: process.env.META_ACCESS_TOKEN!, igUserId: process.env.META_IG_USER_ID!, fetchJson, cache: dbCache(db) });
}

export function createSearchSource(db: ServiceClient): SearchSource | null {
  if (!isConfigured("search")) return null;
  return new SearchSource({ apiKey: process.env.SEARCH_API_KEY!, fetchJson, cache: dbCache(db) });
}

export function profileToRow(p: CreatorProfile, dataStatus: DataStatus): CreatorInsert {
  return {
    platform: p.platform,
    handle: p.handle,
    display_name: p.displayName ?? null,
    url: p.url,
    followers: p.followers,
    engagement_rate: p.engagementRate,
    avg_views: p.avgViews,
    bio: p.bio,
    recent_titles: p.recentTitles,
    external_id: p.externalId ?? null,
    source: p.source,
    data_status: dataStatus,
    enriched_at: p.fetchedAt,
    enrich_error: null,
  };
}

/** Upserts on (platform, handle): a seeded snapshot row becomes Live when the API answers for it. */
export async function upsertProfiles(db: ServiceClient, profiles: CreatorProfile[], dataStatus: DataStatus): Promise<{ added: number; updated: number }> {
  if (profiles.length === 0) return { added: 0, updated: 0 };
  const existing = await db.from("creators").select("platform, handle").in("handle", profiles.map((p) => p.handle));
  if (existing.error) throw new Error(existing.error.message);
  const known = new Set(existing.data.map((r) => `${r.platform}:${r.handle}`));
  const { error } = await db.from("creators").upsert(profiles.map((p) => profileToRow(p, dataStatus)), { onConflict: "platform,handle" });
  if (error) throw new Error(error.message);
  const updated = profiles.filter((p) => known.has(`${p.platform}:${p.handle}`)).length;
  return { added: profiles.length - updated, updated };
}

/** Cross-linked handles become Seeded rows until an adapter enriches them; existing rows are left alone. */
export async function insertCrossLinks(db: ServiceClient, stubs: CreatorStub[]): Promise<number> {
  const unique = new Map(stubs.map((s) => [`${s.platform}:${s.handle.toLowerCase()}`, s]));
  const rows: CreatorInsert[] = [...unique.values()].map((s) => ({
    platform: s.platform, handle: s.handle, url: s.url, display_name: s.displayName ?? null, source: s.source, data_status: "seeded", external_id: s.externalId ?? null,
  }));
  if (rows.length === 0) return 0;
  const { data, error } = await db.from("creators").upsert(rows, { onConflict: "platform,handle", ignoreDuplicates: true }).select("id");
  if (error) throw new Error(error.message);
  return data.length;
}

export async function recordEnrichError(db: ServiceClient, creatorId: string, message: string): Promise<void> {
  const { error } = await db.from("creators").update({ enrich_error: message.slice(0, 300), data_status: "seeded" }).eq("id", creatorId);
  if (error) throw new Error(error.message);
}
