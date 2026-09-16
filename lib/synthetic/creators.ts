import type { Database } from "../db/types.ts";
import { DAY_MS, KIT_PRICE, TODAY_MS } from "./constants.ts";
import type { Person } from "./customers.ts";
import { iso, type KitBundle } from "./kits.ts";
import type { PanelSummary } from "./panels.ts";
import type { Rng } from "./rng.ts";

type Tables = Database["public"]["Tables"];
export type CreatorInsert = Tables["creators"]["Insert"] & { id: string };
export type CampaignInsert = Tables["campaigns"]["Insert"] & { id: string };
export type AttributionInsert = Tables["attributions"]["Insert"] & { id: string };

type Platform = Database["public"]["Enums"]["platform"];
type Seed = { platform: Platform; handle: string; name: string; followers: number; er: number; bio: string; titles: string[] };

/** Thirty seeded Instagram and TikTok creators. The 40 cached YouTube creators arrive with the M4 adapter. */
const SEEDED: Seed[] = [
  // The two story creators (§12): big with a young standalone audience, small with 25–34 hormonal-acne members.
  { platform: "instagram", handle: "tayglowsup", name: "Taylor Nguyen", followers: 430_000, er: 0.021, bio: "GRWM, skincare hauls, dorm life. 19.", titles: ["My 5-step morning routine", "Testing viral pimple patches", "Skincare haul under $40", "Dorm room glow up", "Reacting to your routines"] },
  { platform: "instagram", handle: "hannah.hormonehealth", name: "Hannah Weiss", followers: 61_000, er: 0.064, bio: "Adult acne at 31. What actually worked, tracked for 2 years. PCOS.", titles: ["My hormonal acne timeline, month by month", "Spironolactone: 18 months later", "What my blood work showed", "Cystic jawline acne: what failed first", "Inositol and my skin, honest update"] },
  { platform: "instagram", handle: "clearwithclaire", name: "Claire Dawson", followers: 88_000, er: 0.049, bio: "Esthetician. Adult acne, barrier repair, no hype.", titles: ["Stop over-exfoliating", "Adult acne vs teen acne", "The retinoid ladder", "Why your moisturiser matters", "Barrier repair in 30 days"] },
  { platform: "tiktok", handle: "acne.diaries.jo", name: "Jo Martinez", followers: 240_000, er: 0.083, bio: "Documenting my accutane journey. 24.", titles: ["Accutane month 4 update", "Before and after, 6 months", "Side effects nobody mentions", "Dry lips survival kit", "Day 1 vs day 120"] },
  { platform: "instagram", handle: "dr.amara.skin", name: "Dr. Amara Bello", followers: 155_000, er: 0.038, bio: "Board-certified dermatologist. Evidence over trends.", titles: ["Do blood tests help acne?", "Hormonal acne explained", "Spearmint tea: the evidence", "When to see a derm", "Azelaic acid, properly"] },
  { platform: "tiktok", handle: "pcos.and.me", name: "Dani Reyes", followers: 72_000, er: 0.071, bio: "PCOS, insulin resistance, adult acne. Sharing what my doctors told me.", titles: ["My PCOS diagnosis story", "Insulin resistance and my skin", "Low GI week in my life", "Inositol update month 3", "Blood test results explained"] },
  { platform: "instagram", handle: "glowbyginny", name: "Ginny Park", followers: 12_500, er: 0.092, bio: "Adult acne at 28. Slow skincare. Miami.", titles: ["Jawline breakouts and my cycle", "Minimal routine that works", "Cortisol, sleep and my skin", "One year of progress photos", "Stress acne is real"] },
  { platform: "tiktok", handle: "skinfluencer.max", name: "Max Osei", followers: 510_000, er: 0.055, bio: "Men's skincare, made simple. 22.", titles: ["Beard area breakouts", "Gym acne fix", "Cheap routine for guys", "Back acne, sorted", "Reacting to your skin"] },
  { platform: "instagram", handle: "the.acne.nutritionist", name: "Sara Kaplan", followers: 47_000, er: 0.058, bio: "Registered dietitian. Food, hormones, skin.", titles: ["Dairy and acne, what the research says", "Zinc-rich meals", "Vitamin D in winter", "Blood sugar and breakouts", "Meal prep for clearer skin"] },
  { platform: "instagram", handle: "mira.clearskinclub", name: "Mira Haddad", followers: 33_000, er: 0.067, bio: "Cystic acne survivor. 26. Before/afters over 3 years.", titles: ["3 years of progress", "What I wish I knew at 20", "Tretinoin purge diary", "My hormone panel results", "Skin and my period, tracked"] },
  { platform: "tiktok", handle: "teen.skin.tips", name: "Lexi Brown", followers: 380_000, er: 0.09, bio: "High school skincare. 17.", titles: ["Locker room routine", "Drugstore dupes", "Cheap products that work", "Skincare for school", "Clear skin challenge day 30"] },
  { platform: "instagram", handle: "hormone.hq", name: "Nadia Fischer", followers: 96_000, er: 0.044, bio: "Functional nutritionist. Hormones and adult acne, 30+.", titles: ["Cortisol and your jawline", "Perimenopause acne", "The blood work I order first", "Sleep and skin", "Coffee and cortisol"] },
  { platform: "tiktok", handle: "rosie.retinoids", name: "Rosie Lam", followers: 58_000, er: 0.077, bio: "Adapalene, tretinoin, patience. 25.", titles: ["Purge week 4", "Retinoid sandwich method", "Sunscreen actually matters", "Six months on adapalene", "Hyperpigmentation fades"] },
  { platform: "instagram", handle: "brandon.builds.skin", name: "Brandon Cole", followers: 21_000, er: 0.061, bio: "Adult acne at 29 while lifting. Cortisol, whey, sleep.", titles: ["Whey protein and breakouts", "Cortisol from overtraining", "Deload week skin", "Zinc for lifters", "Progress, 8 months"] },
  { platform: "tiktok", handle: "clearskin.chels", name: "Chelsea Ford", followers: 140_000, er: 0.068, bio: "Hormonal acne at 27. Spiro, then not. Honest.", titles: ["Coming off spironolactone", "Cycle tracking my skin", "What my endo said", "Birth control and acne", "Month 6 update"] },
  { platform: "instagram", handle: "acnefreeandrea", name: "Andrea Lopez", followers: 9_800, er: 0.11, bio: "Nurse. Adult acne, gut health, 34.", titles: ["Night shifts and my skin", "Gut and skin, what I changed", "Vitamin D deficiency", "Zinc and healing", "One year off dairy"] },
  { platform: "tiktok", handle: "skin.with.sam", name: "Sam Patel", followers: 27_000, er: 0.074, bio: "Cystic acne, 23. Inflammation stuff. Turmeric skeptic.", titles: ["hs-CRP explained simply", "Omega-3 update", "Anti-inflammatory week", "Ice rolling honest review", "My blood test"] },
  { platform: "instagram", handle: "kaylaclears", name: "Kayla Simmons", followers: 66_000, er: 0.052, bio: "Postpartum acne. 32. Two kids.", titles: ["Postpartum hormones and skin", "Breastfeeding-safe routine", "Cortisol with a newborn", "Six months postpartum update", "My panel results"] },
  { platform: "tiktok", handle: "budget.skincare.ben", name: "Ben Turner", followers: 205_000, er: 0.048, bio: "Skincare on a student budget. 20.", titles: ["$20 full routine", "Benzoyl peroxide 101", "Dorm skincare", "Dupes that actually work", "Trying viral hacks"] },
  { platform: "instagram", handle: "olivia.pcosjourney", name: "Olivia Grant", followers: 44_000, er: 0.069, bio: "PCOS diagnosed at 29. Insulin, acne, hair.", titles: ["My PCOS labs", "Berberine month 2", "Low GI grocery haul", "Acne and PCOS explained", "What helped my jawline"] },
  { platform: "tiktok", handle: "derm.notes", name: "Dr. Elena Ruiz", followers: 320_000, er: 0.041, bio: "Dermatology resident. Myth-busting.", titles: ["Blood tests for acne: yes or no?", "Hormonal acne myths", "Skincare for cystic acne", "Sunscreen and breakouts", "Ask a derm"] },
  { platform: "instagram", handle: "zoe.zerobreakouts", name: "Zoe Mitchell", followers: 18_000, er: 0.083, bio: "Adult acne, 30. Stress, sleep, skin.", titles: ["Cortisol test results", "Meditation and my skin", "Sleep tracking month", "Ashwagandha honest update", "8 months clear"] },
  { platform: "tiktok", handle: "jay.skin.journey", name: "Jay Kim", followers: 89_000, er: 0.079, bio: "Severe acne to clear. 26. Nothing sponsored.", titles: ["What failed: 5 years", "Accutane vs everything else", "My blood work before and after", "Scars update", "Confidence talk"] },
  { platform: "instagram", handle: "nutrient.nat", name: "Natalie Cruz", followers: 15_000, er: 0.088, bio: "Dietitian. Deficiencies and skin.", titles: ["Zinc test results", "Vitamin D and acne", "Iron and skin", "Foods for healing", "Supplement audit"] },
  { platform: "tiktok", handle: "gymskin.greg", name: "Greg Hall", followers: 130_000, er: 0.06, bio: "Fitness and skin. Creatine, whey, breakouts. 24.", titles: ["Creatine and acne", "Post-workout routine", "Back acne fix", "Sweat and breakouts", "Cheap body wash test"] },
  { platform: "instagram", handle: "maya.mindfulskin", name: "Maya Patel", followers: 39_000, er: 0.063, bio: "Yoga teacher. Stress acne at 33.", titles: ["Cortisol and skin", "Breathwork for stress acne", "My hormone panel", "Sleep routine", "Six months of progress"] },
  { platform: "tiktok", handle: "acne.at.35", name: "Rachel Moore", followers: 52_000, er: 0.072, bio: "Acne started at 35. Perimenopause?", titles: ["Acne at 35, what changed", "Hormone testing at 35", "Perimenopause skin", "What my doctor missed", "Retinoids after 35"] },
  { platform: "instagram", handle: "leo.skinlab", name: "Leo Fernandez", followers: 7_400, er: 0.12, bio: "Biochem student. Reading the acne research so you don't have to.", titles: ["Insulin and IGF-1 explained", "The dairy studies", "Zinc trials review", "Spearmint tea study", "Blood biomarkers for acne"] },
  { platform: "tiktok", handle: "clear.by.thirty", name: "Emma Wright", followers: 95_000, er: 0.066, bio: "Adult acne, 28. Membership-style tracking of everything.", titles: ["Tracking 90 days", "My baseline labs", "Retest results", "Habit stack for skin", "What changed in 3 months"] },
  { platform: "instagram", handle: "skin.scientist.ana", name: "Ana Costa", followers: 112_000, er: 0.045, bio: "PhD, skin biology. Explaining mechanisms.", titles: ["How androgens cause acne", "Inflammation pathways", "Why blood tests can help", "Sebum science", "Barrier and bacteria"] },
];

/** The two creators whose order flips on the leaderboard toggle. */
export const STORY = { big: "tayglowsup", small: "hannah.hormonehealth" } as const;

export type CreatorOutput = { creators: CreatorInsert[]; campaigns: CampaignInsert[]; attributions: AttributionInsert[] };

export function generateCreators(rng: Rng, people: Person[], bundles: KitBundle[], summaries: Map<string, PanelSummary>): CreatorOutput {
  const creators = SEEDED.map((s) => creatorRow(rng, s));
  const byHandle = new Map(creators.map((c) => [c.handle, c]));

  const campaigns: CampaignInsert[] = [];
  const attributions: AttributionInsert[] = [];
  const attributed = new Set<string>();
  const registeredKit = new Set(bundles.filter((b) => b.kit.sequence_no === 1 && b.enteredMs.registered !== undefined).map((b) => b.kit.customer_id));

  const attribute = (campaign: CampaignInsert, chosen: Person[]) => {
    for (const p of chosen) {
      attributed.add(p.customer.id);
      p.customer.creator_code = campaign.code;
      const outcome = summaries.get(p.customer.id);
      attributions.push({
        id: rng.uuid(),
        campaign_id: campaign.id,
        customer_id: p.customer.id,
        order_at: p.customer.created_at,
        order_value: KIT_PRICE[p.customer.plan ?? "standalone"],
        kit_registered: registeredKit.has(p.customer.id),
        retested: p.retested,
        improved: p.retested ? (outcome?.markersImproved ?? 0) > 0 : null,
      });
    }
  };

  // Big creator: young, standalone, mostly no retest. Recent customers count too; they simply have not retested.
  const big = campaign(rng, byHandle.get(STORY.big)!, "TAY20", 5_800);
  const youngStandalone = people.filter((p) => isYoung(p) && p.customer.plan === "standalone" && isSocial(p));
  attribute(big, [...rng.shuffle(youngStandalone.filter((p) => !p.retested)).slice(0, 37), ...rng.shuffle(youngStandalone.filter((p) => p.retested)).slice(0, 3)]);
  campaigns.push(big);

  // Small creator: 25–34, membership_first, mostly retested.
  const small = campaign(rng, byHandle.get(STORY.small)!, "HANNAH", 1_400);
  const members = people.filter((p) => p.customer.age_band === "25-34" && p.customer.plan === "membership_first" && isSocial(p) && p.retestEligible && !attributed.has(p.customer.id));
  attribute(small, [...rng.shuffle(members.filter((p) => p.retested)).slice(0, 10), ...rng.shuffle(members.filter((p) => !p.retested)).slice(0, 6)]);
  campaigns.push(small);

  // Thirteen more campaigns over the remaining social customers.
  const others = rng.shuffle(creators.filter((c) => c.handle !== STORY.big && c.handle !== STORY.small)).slice(0, 13);
  let pool = rng.shuffle(people.filter((p) => isSocial(p) && !attributed.has(p.customer.id)));
  for (const creator of others) {
    const c = campaign(rng, creator, codeFor(creator.handle), rng.int(3, 60) * 100);
    const take = Math.min(pool.length, rng.int(3, 18));
    attribute(c, pool.slice(0, take));
    pool = pool.slice(take);
    campaigns.push(c);
  }

  return { creators, campaigns, attributions };
}

function creatorRow(rng: Rng, s: Seed): CreatorInsert {
  const base = s.platform === "instagram" ? "https://www.instagram.com/" : "https://www.tiktok.com/@";
  return {
    id: rng.uuid(),
    platform: s.platform,
    handle: s.handle,
    display_name: s.name,
    url: `${base}${s.handle}`,
    followers: s.followers,
    engagement_rate: s.er,
    avg_views: Math.round(s.followers * s.er * rng.float(4, 9)),
    bio: s.bio,
    recent_titles: s.titles,
    external_id: null,
    source: "seeded",
    data_status: "seeded",
    enriched_at: null,
  };
}

function campaign(rng: Rng, creator: CreatorInsert, code: string, spend: number): CampaignInsert {
  return {
    id: rng.uuid(),
    creator_id: creator.id,
    code,
    start_at: iso(TODAY_MS - rng.int(120, 330) * DAY_MS),
    spend_usd: spend,
    status: "active",
  };
}

function codeFor(handle: string): string {
  return handle.replace(/[^a-z0-9]/gi, "").slice(0, 6).toUpperCase() + "15";
}

function isYoung(p: Person): boolean {
  return p.customer.age_band === "16-19" || p.customer.age_band === "20-24";
}

function isSocial(p: Person): boolean {
  const c = p.customer.acquisition_channel;
  return c === "instagram" || c === "tiktok" || c === "youtube";
}
