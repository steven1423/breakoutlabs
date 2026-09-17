import { describe, expect, it } from "vitest";
import { cardInput, creatorCardSchema, wordCount } from "@/lib/creators/card";
import type { Database } from "@/lib/db/types";

const valid = {
  summary: "Documents two years of adult acne with monthly labs. Watched by women 25 to 34 who have tried spironolactone.",
  fit_score: 88,
  fit_reasoning: "- hormonal acne is the whole channel\n- shows what failed before what worked\n- audience asks about blood work",
  predicted_segment: "androgen",
  approach_angle: "Offer the retest as the sequel to her blood-work video.",
  price_band_low: 200,
  price_band_high: 1500,
  outreach_draft: "Hi Hannah, your blood-work video is the most honest thing we have seen on hormonal acne. We make the at-home test that measures those same markers and a retest 90 days later. We would like to send you a kit, no strings, and if the results are interesting, you keep them as content. Reply if you want the details.",
};

describe("creator card schema", () => {
  it("accepts a well-formed card", () => {
    expect(creatorCardSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects a fit score of 101, an unknown segment, and a long outreach draft", () => {
    expect(creatorCardSchema.safeParse({ ...valid, fit_score: 101 }).success).toBe(false);
    expect(creatorCardSchema.safeParse({ ...valid, fit_score: 50.5 }).success).toBe(false);
    expect(creatorCardSchema.safeParse({ ...valid, predicted_segment: "stress" }).success).toBe(false);
    const long = Array.from({ length: 121 }, (_, i) => `word${i}`).join(" ");
    expect(wordCount(long)).toBe(121);
    expect(creatorCardSchema.safeParse({ ...valid, outreach_draft: long }).success).toBe(false);
  });

  it("puts the computed price estimate into the model input", () => {
    const creator: Database["public"]["Tables"]["creators"]["Row"] = {
      id: "c1", platform: "instagram", handle: "glowbyginny", display_name: "Ginny", url: "https://www.instagram.com/glowbyginny", followers: 12_500, engagement_rate: 0.092, avg_views: 5_000, bio: "Adult acne at 28", recent_titles: ["a", "b"], external_id: null, source: "seeded", data_status: "seeded", enriched_at: null, enrich_error: null,
    };
    const input = JSON.parse(cardInput(creator));
    expect(input.price_estimate_per_post_usd.tier).toBe("micro");
    expect(input.recent_titles).toEqual(["a", "b"]);
  });
});
