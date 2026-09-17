import { extractCrossLinks } from "./crosslinks.ts";
import type { CreatorSource, CreatorStub, FetchJson, ResponseCache } from "./types.ts";
import { CACHE_TTL_MS } from "./youtube.ts";

/**
 * Optional search adapter (CLAUDE.md §8.4): Serper web search, handles parsed from result URLs only.
 * Hidden unless SEARCH_API_KEY is set. Never fetches instagram.com or tiktok.com pages.
 */

const SERPER = "https://google.serper.dev/search";

export type SearchDeps = { apiKey: string; fetchJson: FetchJson; cache: ResponseCache };

export class SearchSource implements CreatorSource {
  readonly name = "search" as const;
  private readonly deps: SearchDeps;

  constructor(deps: SearchDeps) {
    this.deps = deps;
  }

  async discover(query: string, limit: number): Promise<CreatorStub[]> {
    const key = `search:serper:${query}`;
    const cached = await this.deps.cache.get(key, CACHE_TTL_MS);
    const json = cached
      ? cached.payload
      : await this.deps.fetchJson(SERPER, { method: "POST", headers: { "X-API-KEY": this.deps.apiKey, "content-type": "application/json" }, body: JSON.stringify({ q: query, num: 20 }) });
    if (!cached) await this.deps.cache.set(key, json);
    return parseSearchResults(json).slice(0, limit);
  }
}

export function parseSearchResults(json: unknown): CreatorStub[] {
  const organic = ((json as { organic?: unknown[] })?.organic ?? []) as { link?: unknown }[];
  const urls = organic.map((r) => (typeof r.link === "string" ? r.link : "")).join("\n");
  return extractCrossLinks(urls, "search");
}
