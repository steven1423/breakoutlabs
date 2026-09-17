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

/**
 * We never store a real email address or phone number, even a public business one (CLAUDE.md §16.5).
 * Channel descriptions routinely carry both, so every free-text field is redacted on the way in,
 * including the raw API responses we cache.
 */
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const PHONE_CANDIDATE = /\+?\d[\d\s().-]{7,}\d/g;

export function redactContacts(text: string): string {
  return text.replace(EMAIL, "[email removed]").replace(PHONE_CANDIDATE, redactIfPhone);
}

/**
 * Nine or more digits in free text is treated as a phone number. That is deliberately
 * eager: redacting a large number someone wrote in their bio costs nothing, and missing a
 * real phone number violates §16.5. Eight digits or fewer keeps ISO dates intact.
 */
function redactIfPhone(match: string): string {
  return match.replace(/\D/g, "").length >= 9 ? "[phone removed]" : match;
}

/** Free-text fields in a cached API response. Numbers and ids are left untouched. */
const TEXT_KEYS = new Set(["description", "title", "caption", "biography", "name", "customUrl", "website"]);

/** Redacts contact details inside a cached payload without disturbing its shape or its numbers. */
export function redactPayload(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactPayload);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, v]) => [
        key,
        typeof v === "string" && TEXT_KEYS.has(key) ? redactContacts(v) : redactPayload(v),
      ]),
    );
  }
  return value;
}
