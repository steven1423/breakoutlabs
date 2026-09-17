import { z } from "zod";
import { completeJson } from "../copilot/json.ts";
import type { ModelProvider } from "../copilot/provider.ts";
import type { ServiceClient } from "../db/service.ts";
import type { Database } from "../db/types.ts";
import { priceBand } from "./pricing.ts";

/** The AI creator card (CLAUDE.md §8.6): zod-validated JSON, cached in creator_cards. */

const SEGMENTS = ["androgen", "insulin", "cortisol", "nutrient", "inflammation", "mixed"] as const;
export const OUTREACH_MAX_WORDS = 120;

export const creatorCardSchema = z.object({
  summary: z.string().min(1).max(600),
  fit_score: z.number().int().min(0).max(100),
  fit_reasoning: z.string().min(1).max(1_200),
  predicted_segment: z.enum(SEGMENTS),
  approach_angle: z.string().min(1).max(400),
  price_band_low: z.number().int().min(0),
  price_band_high: z.number().int().min(0),
  outreach_draft: z.string().min(1).refine((s) => wordCount(s) <= OUTREACH_MAX_WORDS, { message: `at most ${OUTREACH_MAX_WORDS} words` }),
});

export type CreatorCard = z.infer<typeof creatorCardSchema>;

export function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export const CARD_INSTRUCTIONS = `You write a one-page partnership card about a social creator for BreakoutLabs, a Miami company selling an at-home acne root-cause blood test (8 biomarkers), a personalised Clear Skin Blueprint, and a $49/month membership with a free retest every 90 days.

Fit rubric (score 0–100): acne-specific content rather than general beauty; adult or hormonal acne mentioned; audience likely 18–34; authenticity signals such as before/after over time and talking about what failed; no medical misinformation. Be specific to acne; do not reward reach alone.

Reply with one JSON object and nothing else:
{"summary": "2 sentences on what they make and who watches",
 "fit_score": 0-100,
 "fit_reasoning": "3 short bullets, acne-specific, separated by newlines, each starting with '- '",
 "predicted_segment": "androgen|insulin|cortisol|nutrient|inflammation|mixed. Name the SINGLE most likely root cause their audience shares, on the evidence in their titles and bio: PCOS, spironolactone, birth control or jawline acne point to androgen; blood sugar, inositol, berberine or low-GI eating to insulin; stress, sleep, burnout or ashwagandha to cortisol; vitamin D, zinc or deficiency testing to nutrient; hs-CRP, omega-3 or anti-inflammatory eating to inflammation. Use mixed ONLY when two or more drivers genuinely share the content with no dominant one, and say in fit_reasoning why nothing dominates. A creator with no acne-specific signal at all is a low fit score, not automatically mixed.",
 "approach_angle": "1 sentence: the hook that would land with this creator",
 "price_band_low": integer, "price_band_high": integer (copy the estimate given in the input),
 "outreach_draft": "at most 120 words, plain, no hype, sentence case, offers a free kit and their results as content"}`;

type CreatorRow = Database["public"]["Tables"]["creators"]["Row"];

export function cardInput(creator: CreatorRow): string {
  const band = priceBand(creator.followers ?? 0, creator.engagement_rate);
  return JSON.stringify({
    platform: creator.platform,
    handle: creator.handle,
    display_name: creator.display_name,
    bio: creator.bio,
    followers: creator.followers,
    engagement_rate: creator.engagement_rate,
    avg_views: creator.avg_views,
    recent_titles: Array.isArray(creator.recent_titles) ? creator.recent_titles.slice(0, 12) : [],
    price_estimate_per_post_usd: { low: band.low, high: band.high, tier: band.tier },
  });
}

/** Generates and caches the card. The price band is computed here, not by the model, so it always matches the tier rule. */
export async function generateCreatorCard(db: ServiceClient, provider: ModelProvider, creatorId: string): Promise<CreatorCard> {
  const { data: creator, error } = await db.from("creators").select("*").eq("id", creatorId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!creator) throw new Error(`No creator ${creatorId}`);

  const band = priceBand(creator.followers ?? 0, creator.engagement_rate);
  const generated = await completeJson(provider, CARD_INSTRUCTIONS, cardInput(creator), creatorCardSchema, "creator card");
  const card: CreatorCard = { ...generated, price_band_low: band.low, price_band_high: band.high };

  const save = await db.from("creator_cards").upsert({ creator_id: creatorId, ...card, model: provider.model, generated_at: new Date().toISOString() });
  if (save.error) throw new Error(save.error.message);
  return card;
}
