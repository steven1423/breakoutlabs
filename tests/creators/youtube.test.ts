import { describe, expect, it } from "vitest";
import type { ResponseCache } from "@/lib/creators/types";
import { YoutubeSource, averageViews, cacheKey, engagementRate, parseChannels, parsePlaylistItems, parseSearch, parseVideos, toProfile } from "@/lib/creators/youtube";

const searchJson = {
  items: [
    { id: { kind: "youtube#channel", channelId: "UC1" }, snippet: { channelId: "UC1" } },
    { id: { kind: "youtube#video", videoId: "v1" }, snippet: { channelId: "UC2" } },
    { id: { kind: "youtube#video", videoId: "v2" }, snippet: { channelId: "UC1" } },
  ],
};
const channelJson = {
  items: [{
    id: "UC1",
    snippet: { title: "Hannah", description: "short", customUrl: "@hannah" },
    statistics: { subscriberCount: "61000", viewCount: "1" },
    contentDetails: { relatedPlaylists: { uploads: "UU1" } },
    brandingSettings: { channel: { description: "Adult acne at 31. instagram.com/hannah.hormonehealth Business: hannah@agency.com" } },
  }],
};
const playlistJson = { items: [{ contentDetails: { videoId: "v1" } }, { contentDetails: { videoId: "v2" } }] };
const videosJson = {
  items: [
    { id: "v1", snippet: { title: "Spiro month 18", description: "more at tiktok.com/@hannahh" }, statistics: { viewCount: "1000", likeCount: "100", commentCount: "22" } },
    { id: "v2", snippet: { title: "My labs", description: "" }, statistics: { viewCount: "3000", likeCount: "200", commentCount: "44" } },
  ],
};

function memoryCache(): ResponseCache & { store: Map<string, unknown> } {
  const store = new Map<string, unknown>();
  return {
    store,
    async get(key) { return store.has(key) ? { payload: store.get(key), fetchedAt: "2026-09-16T00:00:00Z" } : null; },
    async set(key, payload) { store.set(key, payload); },
  };
}

describe("YouTube parsing", () => {
  it("collects channel ids from channel and video results without duplicates", () => {
    expect(parseSearch(searchJson)).toEqual(["UC1", "UC2"]);
  });

  it("reads subscribers, the branding description and the uploads playlist", () => {
    expect(parseChannels(channelJson)).toEqual([{ id: "UC1", handle: "@hannah", title: "Hannah", description: "Adult acne at 31. instagram.com/hannah.hormonehealth Business: hannah@agency.com", subscribers: 61_000, uploadsPlaylist: "UU1" }]);
    expect(parsePlaylistItems(playlistJson)).toEqual(["v1", "v2"]);
  });

  it("averages views and computes engagement over the recent videos", () => {
    const videos = parseVideos(videosJson);
    expect(averageViews(videos)).toBe(2000);
    expect(engagementRate(videos, 61_000)).toBeCloseTo(183 / 61_000, 4);
    expect(averageViews([])).toBeNull();
    expect(engagementRate(videos, 0)).toBeNull();
  });

  it("builds a profile with cross-links from channel and video descriptions", () => {
    const profile = toProfile(parseChannels(channelJson)[0], parseVideos(videosJson), "2026-09-16T00:00:00Z");
    expect(profile).toMatchObject({ platform: "youtube", handle: "@hannah", url: "https://www.youtube.com/@hannah", followers: 61_000, avgViews: 2000, recentTitles: ["Spiro month 18", "My labs"] });
    expect(profile.crossLinks.map((c) => `${c.platform}:${c.handle}`)).toEqual(["instagram:hannah.hormonehealth", "tiktok:hannahh"]);
    expect(profile.bio).toBe("Adult acne at 31. instagram.com/hannah.hormonehealth Business: [email removed]");
  });
});

describe("YoutubeSource", () => {
  function source(cache = memoryCache(), quota = { allowed: true }) {
    const calls: string[] = [];
    const src = new YoutubeSource({
      apiKey: "k",
      cache,
      takeSearchCall: async () => quota.allowed,
      fetchJson: async (url) => {
        calls.push(url);
        if (url.includes("/search?")) return searchJson;
        if (url.includes("/channels?")) return channelJson;
        if (url.includes("/playlistItems?")) return playlistJson;
        if (url.includes("/videos?")) return videosJson;
        throw new Error(`unexpected ${url}`);
      },
    });
    return { src, calls, cache };
  }

  it("discovers with two searches per query, then enriches through channels, playlist and videos", async () => {
    const { src, calls } = source();
    const stubs = await src.discover("hormonal acne journey", 40);
    expect(stubs.map((s) => s.externalId)).toEqual(["UC1", "UC2"]);
    expect(calls.filter((u) => u.includes("/search?"))).toHaveLength(2);
    expect(src.searchCalls).toBe(2);
    const profiles = await src.enrichMany(stubs);
    expect(profiles).toHaveLength(1);
    expect(profiles[0].handle).toBe("@hannah");
    expect(calls.some((u) => u.includes("/playlistItems?") && u.includes("playlistId=UU1"))).toBe(true);
    expect(calls.every((u) => u.includes("key=k"))).toBe(true);
  });

  it("serves a cached key without fetching or spending quota", async () => {
    const cache = memoryCache();
    cache.store.set(cacheKey("search", { part: "snippet", q: "PCOS acne", type: "channel", maxResults: "40" }), searchJson);
    cache.store.set(cacheKey("search", { part: "snippet", q: "PCOS acne", type: "video", maxResults: "40" }), searchJson);
    const { src, calls } = source(cache, { allowed: false });
    const stubs = await src.discover("PCOS acne", 40);
    expect(stubs).toHaveLength(2);
    expect(calls).toHaveLength(0);
    expect(src.searchCalls).toBe(0);
  });

  it("survives a channel whose uploads playlist is gone, rather than failing the whole run", async () => {
    const cache = memoryCache();
    const src = new YoutubeSource({
      apiKey: "k",
      cache,
      takeSearchCall: async () => true,
      fetchJson: async (url) => {
        if (url.includes("/channels?")) return channelJson;
        if (url.includes("/playlistItems?")) throw new Error("The playlist identified with the request's playlistId parameter cannot be found.");
        throw new Error(`unexpected ${url}`);
      },
    });
    const profiles = await src.enrichMany([{ platform: "youtube", handle: "UC1", url: "u", source: "youtube_api", externalId: "UC1" }]);
    expect(profiles).toHaveLength(1);
    expect(profiles[0]).toMatchObject({ handle: "@hannah", followers: 61_000, recentTitles: [], avgViews: null, engagementRate: null });
  });

  it("throws QuotaExhaustedError on a search miss when the day's calls are spent", async () => {
    const { src } = source(memoryCache(), { allowed: false });
    await expect(src.discover("accutane before after", 10)).rejects.toThrow(/quota/i);
  });
});
