import type { Database } from "../db/types.ts";

export type Enums = Database["public"]["Enums"];
export type Segment = Enums["segment"];
export type Marker = Enums["marker"];
export type Sex = Enums["sex_type"];
export type AgeBand = Enums["age_band"];
export type Channel = Enums["channel"];
export type Plan = Enums["plan_type"];
export type KitState = Enums["kit_state"];

export const SEED = "breakoutos-v1";
export const CUSTOMER_COUNT = 500;
/** Fixed "today" so regenerating on a later date still yields identical data. Bump before the demo. */
export const TODAY_MS = Date.UTC(2026, 8, 16, 12, 0, 0);
export const HOUR_MS = 3_600_000;
export const DAY_MS = 24 * HOUR_MS;
export const DEMO_KIT_CODE = "BL-4471-XK";
export const DEMO_FIRST_NAME = "Marissa";

export const AGE_WEIGHTS: readonly (readonly [AgeBand, number])[] = [
  ["16-19", 8], ["20-24", 27], ["25-34", 40], ["35-44", 18], ["45+", 7],
];
export const SEX_WEIGHTS: readonly (readonly [Sex, number])[] = [
  ["female", 78], ["male", 20], ["other", 2],
];
export const CHANNEL_WEIGHTS: readonly (readonly [Channel, number])[] = [
  ["instagram", 40], ["tiktok", 20], ["youtube", 15], ["search", 15], ["referral", 7], ["direct", 3],
];
export const PLAN_WEIGHTS: readonly (readonly [Plan, number])[] = [
  ["standalone", 60], ["membership_first", 30], ["study", 10],
];
export const RETEST_RATE: Record<Plan, number> = { standalone: 0.22, membership_first: 0.58, study: 0.71 };
export const CONSENT_RESEARCH_RATE: Record<Plan, number> = { standalone: 0.3, membership_first: 0.55, study: 0.9 };
export const JOIN_RATE: Record<Plan, number> = { standalone: 0.25, membership_first: 1, study: 1 };
export const KIT_PRICE: Record<Plan, number> = { standalone: 249, membership_first: 99, study: 149 };
export const MEMBERSHIP_PRICE = 49;
export const MONTHLY_CHURN = 0.08;

export const SEGMENT_PRIORS: readonly (readonly [Segment, number])[] = [
  ["androgen", 35], ["insulin", 25], ["cortisol", 20], ["nutrient", 12], ["inflammation", 5], ["mixed", 3],
];

/** US states weighted roughly by population, with FL, TX, CA, NY, GA on top (Miami company). */
export const STATE_WEIGHTS: readonly (readonly [string, number])[] = [
  ["FL", 140], ["TX", 120], ["CA", 115], ["NY", 90], ["GA", 70],
  ["NC", 40], ["IL", 38], ["PA", 36], ["OH", 34], ["NJ", 30], ["AZ", 28], ["VA", 26], ["WA", 25],
  ["MA", 22], ["TN", 22], ["MI", 22], ["CO", 20], ["MD", 18], ["SC", 16], ["IN", 15], ["MO", 14],
  ["WI", 13], ["MN", 13], ["AL", 12], ["LA", 11], ["KY", 10], ["OR", 10], ["OK", 9], ["CT", 8],
  ["UT", 8], ["NV", 8], ["AR", 6], ["MS", 6], ["KS", 6], ["IA", 6], ["NM", 5], ["NE", 4], ["ID", 4],
  ["HI", 4], ["NH", 3], ["ME", 3], ["RI", 3], ["DE", 2], ["MT", 2], ["SD", 2], ["ND", 2], ["VT", 2],
  ["WV", 3], ["AK", 2], ["WY", 1],
];

export const FEMALE_NAMES = [
  "Emma", "Olivia", "Ava", "Sophia", "Isabella", "Mia", "Amelia", "Harper", "Evelyn", "Abigail",
  "Emily", "Ella", "Madison", "Scarlett", "Victoria", "Aria", "Grace", "Chloe", "Camila", "Penelope",
  "Riley", "Layla", "Lillian", "Nora", "Zoey", "Hannah", "Lily", "Addison", "Eleanor", "Natalie",
  "Luna", "Savannah", "Brooklyn", "Leah", "Zoe", "Stella", "Hazel", "Ellie", "Paisley", "Audrey",
  "Skylar", "Violet", "Claire", "Bella", "Aurora", "Lucy", "Anna", "Samantha", "Caroline", "Genesis",
  "Aaliyah", "Kennedy", "Kinsley", "Allison", "Maya", "Sarah", "Madelyn", "Adeline", "Alexa", "Ariana",
  "Priya", "Sofia", "Valentina", "Camille", "Jasmine", "Naomi", "Alina", "Daniela", "Mariana", "Talia",
];
export const MALE_NAMES = [
  "Liam", "Noah", "Oliver", "Elijah", "William", "James", "Benjamin", "Lucas", "Henry", "Alexander",
  "Mason", "Michael", "Ethan", "Daniel", "Jacob", "Logan", "Jackson", "Levi", "Sebastian", "Mateo",
  "Jack", "Owen", "Theodore", "Aiden", "Samuel", "Joseph", "John", "David", "Wyatt", "Matthew",
  "Luke", "Asher", "Carter", "Julian", "Grayson", "Leo", "Jayden", "Gabriel", "Isaac", "Lincoln",
];
export const OTHER_NAMES = ["Alex", "Sam", "Jordan", "Taylor", "Casey", "Riley", "Avery", "Quinn", "Rowan", "Sage"];
export const EMAIL_DOMAINS: readonly (readonly [string, number])[] = [
  ["gmail.com", 62], ["yahoo.com", 12], ["icloud.com", 12], ["outlook.com", 9], ["hotmail.com", 5],
];

export type RefRange = { low: number; high: number; unit: string };

/** Illustrative adult ranges for synthetic data only, not clinical guidance (CLAUDE.md §12). */
export function refRange(marker: Marker, sex: Sex): RefRange {
  const female = sex !== "male";
  switch (marker) {
    case "testosterone": return female ? { low: 15, high: 70, unit: "ng/dL" } : { low: 300, high: 1000, unit: "ng/dL" };
    case "dhea_s": return { low: 35, high: 430, unit: "µg/dL" };
    case "shbg": return female ? { low: 20, high: 130, unit: "nmol/L" } : { low: 10, high: 57, unit: "nmol/L" };
    case "cortisol": return { low: 6, high: 23, unit: "µg/dL" };
    case "insulin": return { low: 2, high: 20, unit: "µIU/mL" };
    case "vitamin_d": return { low: 30, high: 100, unit: "ng/mL" };
    case "zinc": return { low: 60, high: 120, unit: "µg/dL" };
    case "hs_crp": return { low: 0, high: 3, unit: "mg/L" };
  }
}

export const MARKERS: readonly Marker[] = [
  "testosterone", "dhea_s", "shbg", "cortisol", "insulin", "vitamin_d", "zinc", "hs_crp",
];

/** Happy-path dwell time per state in hours: [min, max]. checkin_active and retest_due are computed. */
export const DWELL_HOURS: Partial<Record<KitState, readonly [number, number]>> = {
  ordered: [6, 36],
  shipped: [48, 120],
  delivered: [12, 96],
  registered: [24, 120],
  sample_received: [72, 144],
  resulted: [2, 48],
  blueprint_ready: [12, 72],
  viewed: [24, 240],
};
export const CHECKIN_DAYS_BEFORE_RETEST_DUE = 75;
export const RETEST_DAY_RANGE: readonly [number, number] = [85, 110];
/** Old enough that a retest ordered at day 110 has resulted by today, even with slow dwell times. */
export const RETEST_ELIGIBLE_AGE_DAYS = 160;
