import { describe, expect, it } from "vitest";
import { extractCrossLinks, redactEmails } from "@/lib/creators/crosslinks";

describe("extractCrossLinks", () => {
  it("pulls Instagram and TikTok handles out of mixed text", () => {
    const text = "Find me on https://www.instagram.com/hannah.hormonehealth and tiktok.com/@acne.diaries.jo for daily updates";
    expect(extractCrossLinks(text)).toEqual([
      { platform: "instagram", handle: "hannah.hormonehealth", url: "https://www.instagram.com/hannah.hormonehealth", source: "youtube_api" },
      { platform: "tiktok", handle: "acne.diaries.jo", url: "https://www.tiktok.com/@acne.diaries.jo", source: "youtube_api" },
    ]);
  });

  it("ignores trailing punctuation and query strings", () => {
    const links = extractCrossLinks("insta: instagram.com/glowbyginny. tiktok: https://tiktok.com/@rosie.retinoids?lang=en");
    expect(links.map((l) => l.handle)).toEqual(["glowbyginny", "rosie.retinoids"]);
  });

  it("collapses duplicates regardless of case and skips site sections", () => {
    const links = extractCrossLinks("instagram.com/Mira instagram.com/mira instagram.com/p/abc123 instagram.com/reel/xyz tiktok.com/@Mira");
    expect(links.map((l) => `${l.platform}:${l.handle}`)).toEqual(["instagram:Mira", "tiktok:Mira"]);
  });

  it("finds nothing in unrelated URLs", () => {
    expect(extractCrossLinks("see youtube.com/@someone and https://example.com/instagram.com/not-a-host")).toEqual(
      expect.arrayContaining([]),
    );
    expect(extractCrossLinks("nothing here https://twitter.com/x")).toEqual([]);
  });

  it("redacts email addresses so no profile ever stores one", () => {
    expect(redactEmails("Business: collab.with.me@gmail.com or me@studio.co.uk. IG instagram.com/me")).toBe("Business: [email removed] or [email removed]. IG instagram.com/me");
    expect(redactEmails("no email here")).toBe("no email here");
  });
});
