import { profileUrl } from "./types.ts";
import type { CreatorStub, SourceName } from "./types.ts";

/** Instagram and TikTok handles named in a description (CLAUDE.md §8.2). Handles only; no page is fetched. */
const INSTAGRAM = /instagram\.com\/([A-Za-z0-9_.]+)/g;
const TIKTOK = /tiktok\.com\/@([A-Za-z0-9_.]+)/g;

/** Paths that look like handles but are site sections. */
const NOT_HANDLES = new Set(["p", "reel", "reels", "explore", "stories", "accounts", "tv", "share", "discover", "tag", "foryou", "search"]);

export function extractCrossLinks(text: string, source: SourceName = "youtube_api"): CreatorStub[] {
  const found = new Map<string, CreatorStub>();
  for (const [platform, pattern] of [["instagram", INSTAGRAM], ["tiktok", TIKTOK]] as const) {
    for (const match of text.matchAll(pattern)) {
      const handle = clean(match[1]);
      if (!handle || NOT_HANDLES.has(handle.toLowerCase())) continue;
      const key = `${platform}:${handle.toLowerCase()}`;
      if (!found.has(key)) found.set(key, { platform, handle, url: profileUrl(platform, handle), source });
    }
  }
  return [...found.values()];
}

/** Strips trailing punctuation a sentence leaves on a URL, e.g. "instagram.com/name." */
function clean(raw: string): string {
  return raw.replace(/[._]+$/, "");
}

/** We never store an email address, even a public business one (CLAUDE.md §16). */
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

export function redactEmails(text: string): string {
  return text.replace(EMAIL, "[email removed]");
}
