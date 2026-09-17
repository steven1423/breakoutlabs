import { redactContacts } from "./crosslinks.ts";
import type { CreatorProfile, CreatorSource, CreatorStub, FetchJson, ResponseCache } from "./types.ts";
import { CACHE_TTL_MS } from "./youtube.ts";

/**
 * Meta Instagram Business Discovery adapter (CLAUDE.md §8.3). Server only, behind META_ACCESS_TOKEN and META_IG_USER_ID.
 * Only professional accounts resolve; any error keeps the row Seeded with the reason stored on it.
 */

const GRAPH = "https://graph.facebook.com/v21.0";
const FIELDS = "business_discovery.username({handle}){username,name,biography,followers_count,media_count,website,media.limit(12){like_count,comments_count,caption,timestamp,permalink,media_type}}";

export type InstagramDeps = { token: string; igUserId: string; fetchJson: FetchJson; cache: ResponseCache };

export class InstagramSource implements CreatorSource {
  readonly name = "ig_business_discovery" as const;
  private readonly deps: InstagramDeps;

  constructor(deps: InstagramDeps) {
    this.deps = deps;
  }

  async enrich(stub: CreatorStub): Promise<CreatorProfile> {
    const key = `instagram:business_discovery:${stub.handle.toLowerCase()}`;
    const cached = await this.deps.cache.get(key, CACHE_TTL_MS);
    const json = cached ? cached.payload : await this.deps.fetchJson(businessDiscoveryUrl(this.deps.igUserId, stub.handle, this.deps.token));
    if (!cached) await this.deps.cache.set(key, json);
    return parseBusinessDiscovery(json, cached?.fetchedAt ?? new Date().toISOString());
  }
}

export function businessDiscoveryUrl(igUserId: string, handle: string, token: string): string {
  const fields = FIELDS.replace("{handle}", handle.replace(/[^A-Za-z0-9_.]/g, ""));
  return `${GRAPH}/${igUserId}?${new URLSearchParams({ fields, access_token: token })}`;
}

type Json = Record<string, unknown>;
const num = (v: unknown): number => (typeof v === "number" ? v : 0);
const str = (v: unknown): string => (typeof v === "string" ? v : "");

/** Throws with Meta's message when the account is not a professional account or the call was rate limited. */
export function parseBusinessDiscovery(json: unknown, fetchedAt: string): CreatorProfile {
  const root = (json ?? {}) as Json;
  if (root.error) throw new Error(str((root.error as Json).message) || "Instagram API error");
  const account = root.business_discovery as Json | undefined;
  if (!account) throw new Error("No business_discovery in the response (not a professional account?)");
  const media = (((account.media as Json | undefined)?.data ?? []) as Json[]).slice(0, 12);
  const followers = num(account.followers_count);
  const interactions = media.map((m) => num(m.like_count) + num(m.comments_count));
  const mean = interactions.length ? interactions.reduce((a, b) => a + b, 0) / interactions.length : 0;
  const handle = str(account.username);
  return {
    platform: "instagram",
    handle,
    url: `https://www.instagram.com/${handle}`,
    source: "ig_business_discovery",
    externalId: str(account.id) || undefined,
    displayName: str(account.name) || undefined,
    followers,
    engagementRate: followers > 0 && media.length > 0 ? Math.round((mean / followers) * 10_000) / 10_000 : null,
    avgViews: null,
    bio: redactContacts(str(account.biography)).slice(0, 1_000),
    recentTitles: media.map((m) => redactContacts(str(m.caption).split("\n")[0]).slice(0, 120)).filter(Boolean),
    crossLinks: [],
    fetchedAt,
  };
}
