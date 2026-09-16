import { describe, expect, it } from "vitest";
import { businessDiscoveryUrl, parseBusinessDiscovery } from "@/lib/creators/instagram";
import { parseSearchResults } from "@/lib/creators/search";

describe("Instagram business discovery", () => {
  it("computes engagement from the last 12 posts over followers", () => {
    const json = { business_discovery: { id: "17841", username: "glowbyginny", name: "Ginny", biography: "Adult acne at 28", followers_count: 10_000, media: { data: [{ like_count: 400, comments_count: 100, caption: "Jawline\nmore" }, { like_count: 200, comments_count: 100 }] } } };
    const profile = parseBusinessDiscovery(json, "2026-09-16T00:00:00Z");
    expect(profile).toMatchObject({ platform: "instagram", handle: "glowbyginny", followers: 10_000, engagementRate: 0.04, recentTitles: ["Jawline"], source: "ig_business_discovery" });
  });

  it("throws with Meta's reason so the row stays Seeded with the message", () => {
    expect(() => parseBusinessDiscovery({ error: { message: "(#100) The account is not a professional account" } }, "")).toThrow(/professional/);
    expect(() => parseBusinessDiscovery({}, "")).toThrow(/business_discovery/);
  });

  it("builds the documented field query for a sanitised handle", () => {
    const url = businessDiscoveryUrl("123", "hannah.hormone health", "tok");
    expect(url).toContain("graph.facebook.com/v21.0/123?");
    expect(decodeURIComponent(url)).toContain("business_discovery.username(hannah.hormonehealth){username,name,biography,followers_count");
  });
});

describe("search adapter", () => {
  it("parses handles from result URLs only", () => {
    const stubs = parseSearchResults({ organic: [{ link: "https://www.instagram.com/hormone.hq/" }, { link: "https://www.tiktok.com/@derm.notes/video/1" }, { link: "https://example.com" }] });
    expect(stubs.map((s) => `${s.platform}:${s.handle}:${s.source}`)).toEqual(["instagram:hormone.hq:search", "tiktok:derm.notes:search"]);
  });
});
