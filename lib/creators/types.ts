import type { Database } from "../db/types.ts";

export type Platform = Database["public"]["Enums"]["platform"];
export type SourceName = "youtube_api" | "ig_business_discovery" | "search" | "seeded";

/** A creator we know exists but have not measured: enough to make a row and a link. */
export type CreatorStub = {
  platform: Platform;
  handle: string;
  url: string;
  source: SourceName;
  externalId?: string;
  displayName?: string;
};

/** A stub filled with metrics from an official API. */
export type CreatorProfile = CreatorStub & {
  followers: number;
  engagementRate: number | null;
  avgViews: number | null;
  bio: string;
  recentTitles: string[];
  crossLinks: CreatorStub[];
  fetchedAt: string;
};

/** CLAUDE.md §8.1. Adapters are interchangeable; each row records which one produced it. */
export interface CreatorSource {
  readonly name: SourceName;
  discover?(query: string, limit: number): Promise<CreatorStub[]>;
  enrich?(stub: CreatorStub): Promise<CreatorProfile>;
}

/** Minimal JSON fetch so adapters can be tested with fixtures and no network. */
export type FetchJson = (url: string, init?: RequestInit) => Promise<unknown>;

/** Cache-first reads: every API response is stored under its request key (migration 0007). */
export interface ResponseCache {
  get(key: string, maxAgeMs: number): Promise<{ payload: unknown; fetchedAt: string } | null>;
  set(key: string, payload: unknown): Promise<void>;
}

export async function fetchJson(url: string, init?: RequestInit): Promise<unknown> {
  const response = await fetch(url, init);
  const body = (await response.json().catch(() => null)) as unknown;
  if (!response.ok) {
    const message = errorMessage(body) ?? `${response.status} ${response.statusText}`;
    throw new Error(message);
  }
  return body;
}

function errorMessage(body: unknown): string | null {
  if (!body || typeof body !== "object" || !("error" in body)) return null;
  const err = (body as { error: unknown }).error;
  if (typeof err === "string") return err;
  if (err && typeof err === "object" && "message" in err && typeof (err as { message: unknown }).message === "string") return (err as { message: string }).message;
  return null;
}

export function profileUrl(platform: Platform, handle: string): string {
  if (platform === "youtube") return `https://www.youtube.com/${handle.startsWith("@") ? handle : `@${handle}`}`;
  if (platform === "instagram") return `https://www.instagram.com/${handle}`;
  return `https://www.tiktok.com/@${handle}`;
}
