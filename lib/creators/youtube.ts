import { extractCrossLinks, redactContacts } from "./crosslinks.ts";
import type { CreatorProfile, CreatorSource, CreatorStub, FetchJson, ResponseCache } from "./types.ts";

/**
 * YouTube Data API v3 adapter (CLAUDE.md §8.2). Server only.
 * Every response is cached for a day; search.list (100 units) goes through the daily counter.
 * The last 12 uploads come from the channel's uploads playlist (1 unit) rather than a second search.
 */

export const DISCOVERY_QUERIES = [
  "hormonal acne journey",
  "adult acne routine",
  "cystic acne what worked",
  "acne blood test",
  "PCOS acne",
  "spironolactone acne",
  "accutane before after",
] as const;

export const CACHE_TTL_MS = 24 * 3_600_000;
/**
 * A partnership prospect needs an audience. Below this the channel is a private individual
 * posting about their own acne, which is not someone to put on a leaderboard and not what
 * "public professional-account data" means (CLAUDE.md §2).
 */
export const MIN_SUBSCRIBERS = 1_000;
const API = "https://www.googleapis.com/youtube/v3";
const RECENT_VIDEOS = 12;

export class QuotaExhaustedError extends Error {
  constructor() {
    super("YouTube search quota for today is spent (60 search calls). Cached results still work; try again tomorrow.");
  }
}

export type YoutubeDeps = {
  apiKey: string;
  fetchJson: FetchJson;
  cache: ResponseCache;
  /** Resolves false once the day's search calls are spent. Only called on a cache miss. */
  takeSearchCall: () => Promise<boolean>;
};

export type ChannelSummary = { id: string; handle: string; title: string; description: string; subscribers: number; uploadsPlaylist: string | null };
export type VideoSummary = { id: string; title: string; description: string; views: number; likes: number; comments: number };

export class YoutubeSource implements CreatorSource {
  readonly name = "youtube_api" as const;
  private readonly deps: YoutubeDeps;
  searchCalls = 0;

  constructor(deps: YoutubeDeps) {
    this.deps = deps;
  }

  /** Channels named by a channel search and by the channels behind a video search, as stubs keyed by channel id. */
  async discover(query: string, limit: number): Promise<CreatorStub[]> {
    const ids = new Set<string>();
    for (const type of ["channel", "video"] as const) {
      const json = await this.search({ q: query, type, maxResults: String(Math.min(50, Math.max(limit, 1))) });
      for (const id of parseSearch(json)) ids.add(id);
    }
    return [...ids].slice(0, limit).map(channelStub);
  }

  async enrich(stub: CreatorStub): Promise<CreatorProfile> {
    const [profile] = await this.enrichMany([stub]);
    if (!profile) throw new Error(`YouTube channel ${stub.externalId ?? stub.handle} not found`);
    return profile;
  }

  /** channels.list takes 50 ids per unit; then one playlist read and one videos.list batch per channel. */
  async enrichMany(stubs: CreatorStub[]): Promise<CreatorProfile[]> {
    const ids = stubs.map((s) => s.externalId).filter((id): id is string => Boolean(id));
    const channels: ChannelSummary[] = [];
    for (let i = 0; i < ids.length; i += 50) {
      const json = await this.get("channels", { part: "snippet,statistics,contentDetails,brandingSettings", id: ids.slice(i, i + 50).join(","), maxResults: "50" });
      channels.push(...parseChannels(json));
    }
    const profiles: CreatorProfile[] = [];
    for (const channel of channels) {
      const videos = channel.uploadsPlaylist ? await this.recentVideos(channel.uploadsPlaylist) : [];
      profiles.push(toProfile(channel, videos, new Date().toISOString()));
    }
    return profiles;
  }

  /**
   * A channel can hide, empty or delete its uploads playlist, and the API answers 404. That is a
   * fact about one channel, not a reason to fail a forty-channel run, so it yields no videos.
   */
  private async recentVideos(playlistId: string): Promise<VideoSummary[]> {
    try {
      const items = await this.get("playlistItems", { part: "contentDetails", playlistId, maxResults: String(RECENT_VIDEOS) });
      const videoIds = parsePlaylistItems(items);
      if (videoIds.length === 0) return [];
      const json = await this.get("videos", { part: "snippet,statistics", id: videoIds.join(","), maxResults: String(RECENT_VIDEOS) });
      return parseVideos(json);
    } catch (err) {
      if (err instanceof QuotaExhaustedError) throw err;
      return [];
    }
  }

  private async search(params: Record<string, string>): Promise<unknown> {
    return this.get("search", { part: "snippet", ...params }, true);
  }

  /** Cache first; a miss on a search call consumes quota before the request goes out. */
  private async get(endpoint: string, params: Record<string, string>, isSearch = false): Promise<unknown> {
    const key = cacheKey(endpoint, params);
    const cached = await this.deps.cache.get(key, CACHE_TTL_MS);
    if (cached) return cached.payload;
    if (isSearch) {
      if (!(await this.deps.takeSearchCall())) throw new QuotaExhaustedError();
      this.searchCalls++;
    }
    const url = `${API}/${endpoint}?${new URLSearchParams({ ...params, key: this.deps.apiKey })}`;
    const json = await this.deps.fetchJson(url);
    await this.deps.cache.set(key, json);
    return json;
  }
}

export function cacheKey(endpoint: string, params: Record<string, string>): string {
  const sorted = Object.keys(params).sort().map((k) => `${k}=${params[k]}`).join("&");
  return `youtube:${endpoint}?${sorted}`;
}

function channelStub(id: string): CreatorStub {
  return { platform: "youtube", handle: id, url: `https://www.youtube.com/channel/${id}`, source: "youtube_api", externalId: id };
}

type Json = Record<string, unknown>;
const items = (json: unknown): Json[] => (Array.isArray((json as Json)?.items) ? ((json as Json).items as Json[]) : []);
const str = (v: unknown): string => (typeof v === "string" ? v : "");
const num = (v: unknown): number => (typeof v === "string" || typeof v === "number" ? Number(v) || 0 : 0);

/** Channel ids from a search.list response, whether the results are channels or videos. */
export function parseSearch(json: unknown): string[] {
  const ids: string[] = [];
  for (const item of items(json)) {
    const id = item.id as Json | undefined;
    const snippet = item.snippet as Json | undefined;
    const channelId = str(id?.channelId) || str(snippet?.channelId);
    if (channelId && !ids.includes(channelId)) ids.push(channelId);
  }
  return ids;
}

export function parseChannels(json: unknown): ChannelSummary[] {
  return items(json).map((item) => {
    const snippet = (item.snippet ?? {}) as Json;
    const stats = (item.statistics ?? {}) as Json;
    const related = ((item.contentDetails as Json | undefined)?.relatedPlaylists ?? {}) as Json;
    const branding = (((item.brandingSettings as Json | undefined)?.channel ?? {}) as Json);
    const customUrl = str(snippet.customUrl);
    return {
      id: str(item.id),
      handle: customUrl || str(item.id),
      title: str(snippet.title),
      description: str(branding.description) || str(snippet.description),
      subscribers: num(stats.subscriberCount),
      uploadsPlaylist: str(related.uploads) || null,
    };
  });
}

export function parsePlaylistItems(json: unknown): string[] {
  return items(json).map((item) => str((item.contentDetails as Json | undefined)?.videoId)).filter(Boolean);
}

export function parseVideos(json: unknown): VideoSummary[] {
  return items(json).map((item) => {
    const snippet = (item.snippet ?? {}) as Json;
    const stats = (item.statistics ?? {}) as Json;
    return { id: str(item.id), title: str(snippet.title), description: str(snippet.description), views: num(stats.viewCount), likes: num(stats.likeCount), comments: num(stats.commentCount) };
  });
}

export function averageViews(videos: VideoSummary[]): number | null {
  if (videos.length === 0) return null;
  return Math.round(videos.reduce((sum, v) => sum + v.views, 0) / videos.length);
}

/** Same definition as Instagram (§8.3): mean interactions on the last 12 over followers. */
export function engagementRate(videos: VideoSummary[], followers: number): number | null {
  if (videos.length === 0 || followers <= 0) return null;
  const mean = videos.reduce((sum, v) => sum + v.likes + v.comments, 0) / videos.length;
  return Math.round((mean / followers) * 10_000) / 10_000;
}

export function toProfile(channel: ChannelSummary, videos: VideoSummary[], fetchedAt: string): CreatorProfile {
  const text = [channel.description, ...videos.map((v) => v.description)].join("\n");
  return {
    platform: "youtube",
    handle: channel.handle,
    url: channel.handle.startsWith("@") ? `https://www.youtube.com/${channel.handle}` : `https://www.youtube.com/channel/${channel.id}`,
    source: "youtube_api",
    externalId: channel.id,
    displayName: channel.title,
    followers: channel.subscribers,
    engagementRate: engagementRate(videos, channel.subscribers),
    avgViews: averageViews(videos),
    bio: redactContacts(channel.description).slice(0, 1_000),
    recentTitles: videos.map((v) => redactContacts(v.title)).slice(0, RECENT_VIDEOS),
    crossLinks: extractCrossLinks(text, "youtube_api"),
    fetchedAt,
  };
}
