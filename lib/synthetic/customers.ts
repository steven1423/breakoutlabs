import type { Database } from "../db/types.ts";
import {
  AGE_WEIGHTS, CHANNEL_WEIGHTS, CONSENT_RESEARCH_RATE, DAY_MS, DEMO_FIRST_NAME, EMAIL_DOMAINS,
  FEMALE_NAMES, JOIN_RATE, MALE_NAMES, MONTHLY_CHURN, OTHER_NAMES, PLAN_WEIGHTS, RETEST_ELIGIBLE_AGE_DAYS,
  RETEST_RATE, SEGMENT_PRIORS, SEX_WEIGHTS, STATE_WEIGHTS, TODAY_MS,
  type AgeBand, type Channel, type Plan, type Segment, type Sex,
} from "./constants.ts";
import type { Rng } from "./rng.ts";

export type CustomerInsert = Database["public"]["Tables"]["customers"]["Insert"];
export type CustomerRow = CustomerInsert & { id: string; created_at: string };

/** A customer plus the private facts the rest of the generator needs. Not a table row. */
export type Person = {
  customer: CustomerRow;
  segment: Segment;
  confidence: number;
  ageDays: number;
  retestEligible: boolean;
  retested: boolean;
};

export function generatePeople(rng: Rng, count: number): Person[] {
  // Exact §12 shares by construction; everything else is drawn per person.
  const sexes = rng.quotas(SEX_WEIGHTS, count);
  const ages = rng.quotas(AGE_WEIGHTS, count);
  const plans = rng.quotas(PLAN_WEIGHTS, count);
  const channels = rng.quotas(CHANNEL_WEIGHTS, count);
  const people: Person[] = [];
  for (let i = 0; i < count; i++) {
    people.push(generatePerson(rng, { sex: sexes[i], ageBand: ages[i], plan: plans[i], channel: channels[i] }));
  }
  // Person 0 is the demo customer whose kit BL-4471-XK sits in results_locked (CLAUDE.md §17).
  people[0] = demoPerson(rng, people[0]);
  return people;
}

type Assigned = { sex: Sex; ageBand: AgeBand; plan: Plan; channel: Channel };

function generatePerson(rng: Rng, { sex, ageBand, plan, channel }: Assigned): Person {
  const ageDays = customerAgeDays(rng);
  const createdMs = TODAY_MS - ageDays * DAY_MS;
  const membership = membershipFor(rng, plan, ageDays);
  const retestEligible = ageDays >= RETEST_ELIGIBLE_AGE_DAYS;
  return {
    customer: {
      id: rng.uuid(),
      email_masked: maskedEmail(rng),
      first_name: firstName(rng, sex),
      region_state: rng.weighted(STATE_WEIGHTS),
      age_band: ageBand,
      sex,
      acquisition_channel: channel,
      creator_code: null,
      plan,
      membership: membership.status,
      membership_started_at: membership.startedAt,
      membership_months: membership.months,
      consent_research: rng.chance(CONSENT_RESEARCH_RATE[plan]),
      consent_marketing: rng.chance(0.7),
      created_at: new Date(createdMs).toISOString(),
    },
    segment: segmentFor(rng, ageBand),
    confidence: round2(rng.float(0.55, 0.95)),
    ageDays,
    retestEligible,
    retested: retestEligible && rng.chance(RETEST_RATE[plan]),
  };
}

/** Days since first order, 1..365, tilted toward recent months to mimic growth. */
function customerAgeDays(rng: Rng): number {
  return 1 + Math.floor(364 * Math.pow(rng.next(), 1.3));
}

function membershipFor(rng: Rng, plan: Plan, ageDays: number) {
  if (!rng.chance(JOIN_RATE[plan])) return { status: "none" as const, startedAt: null, months: 0 };
  const monthsSinceStart = Math.floor(ageDays / 30);
  let months = 0;
  for (let m = 1; m <= monthsSinceStart; m++) {
    months = m;
    if (m > 3 && rng.chance(MONTHLY_CHURN)) {
      return { status: "cancelled" as const, startedAt: startedAt(ageDays), months };
    }
  }
  return { status: "active" as const, startedAt: startedAt(ageDays), months };
}

function startedAt(ageDays: number): string {
  return new Date(TODAY_MS - ageDays * DAY_MS).toISOString();
}

/** Segment priors from §12, with insulin skewing 25+ and androgen skewing under 30. */
function segmentFor(rng: Rng, ageBand: AgeBand): Segment {
  const young = ageBand === "16-19" || ageBand === "20-24";
  const older = ageBand === "35-44" || ageBand === "45+";
  const weights = SEGMENT_PRIORS.map(([segment, weight]) => {
    let w = weight;
    if (segment === "androgen") w *= young ? 1.4 : older ? 0.7 : 1;
    if (segment === "insulin") w *= young ? 0.6 : older ? 1.4 : 1;
    return [segment, w] as const;
  });
  return rng.weighted(weights);
}

function firstName(rng: Rng, sex: Sex): string {
  if (sex === "female") return rng.pick(FEMALE_NAMES);
  if (sex === "male") return rng.pick(MALE_NAMES);
  return rng.pick(OTHER_NAMES);
}

/** We never hold a real email. The mask is generated directly: one letter, stars, a domain. */
function maskedEmail(rng: Rng): string {
  const letter = String.fromCharCode(97 + rng.int(0, 25));
  return `${letter}***@${rng.weighted(EMAIL_DOMAINS)}`;
}

function demoPerson(rng: Rng, base: Person): Person {
  const ageDays = 16;
  return {
    ...base,
    customer: {
      ...base.customer,
      first_name: DEMO_FIRST_NAME,
      sex: "female",
      age_band: "25-34",
      region_state: "FL",
      acquisition_channel: "instagram" satisfies Channel,
      plan: "membership_first",
      membership: "active",
      membership_started_at: startedAt(ageDays),
      membership_months: 0,
      consent_research: true,
      created_at: startedAt(ageDays),
    },
    segment: "androgen",
    confidence: round2(rng.float(0.8, 0.95)),
    ageDays,
    retestEligible: false,
    retested: false,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
