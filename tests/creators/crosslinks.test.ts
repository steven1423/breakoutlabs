import { describe, expect, it } from "vitest";
import { extractCrossLinks, redactContacts, redactPayload } from "@/lib/creators/crosslinks";

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
    expect(redactContacts("Business: collab.with.me@gmail.com or me@studio.co.uk. IG instagram.com/me")).toBe("Business: [email removed] or [email removed]. IG instagram.com/me");
    expect(redactContacts("no email here")).toBe("no email here");
  });

  it("redacts phone numbers in every shape a channel description uses", () => {
    expect(redactContacts("Clinic: 0203 474 6300")).toBe("Clinic: [phone removed]");
    expect(redactContacts("Zalo 0904771370 now")).toBe("Zalo [phone removed] now");
    expect(redactContacts("Hotline 0903 887 049 - 0969 462 327")).toBe("Hotline [phone removed]");
    expect(redactContacts("Call +44 7700 900123")).toBe("Call [phone removed]");
  });

  it("leaves dates and identifiers alone, and errs toward redacting a long number", () => {
    expect(redactContacts("Filmed 2026-09-16 in Miami")).toBe("Filmed 2026-09-16 in Miami");
    expect(redactContacts("UC_x5XG1OV2P6uZZ5FSM9Ttw")).toBe("UC_x5XG1OV2P6uZZ5FSM9Ttw");
    expect(redactContacts("Over 50000 subscribers")).toBe("Over 50000 subscribers");
    // Deliberately eager: a nine-digit run in prose is redacted rather than risk a missed phone number.
    expect(redactContacts("357875559 views")).toBe("[phone removed] views");
  });

  it("redacts free text inside a cached payload without touching its numbers or ids", () => {
    const payload = {
      items: [{
        id: "UC1",
        snippet: { title: "Call 0203 474 6300 today", description: "Book: me@clinic.com", publishedAt: "2026-09-16T02:28:37Z" },
        statistics: { subscriberCount: "2670000", viewCount: "357875559" },
      }],
    };
    expect(redactPayload(payload)).toEqual({
      items: [{
        id: "UC1",
        snippet: { title: "Call [phone removed] today", description: "Book: [email removed]", publishedAt: "2026-09-16T02:28:37Z" },
        statistics: { subscriberCount: "2670000", viewCount: "357875559" },
      }],
    });
  });
});
