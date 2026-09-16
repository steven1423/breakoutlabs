import { describe, it } from "vitest";
import { AGE_WEIGHTS, CHANNEL_WEIGHTS, CONSENT_RESEARCH_RATE, PLAN_WEIGHTS, SEGMENT_PRIORS, SEX_WEIGHTS } from "@/lib/synthetic/constants";
import { dataset, expectNear, share } from "./helpers";

const POINTS = 0.03;

describe("customer distributions (CLAUDE.md §12)", () => {
  const { customers, customer_segments } = dataset();

  it("plan, age, sex and channel shares are within three points", () => {
    for (const [plan, w] of PLAN_WEIGHTS) expectNear(share(customers, (c) => c.plan === plan), w / 100, POINTS, `plan ${plan}`);
    for (const [band, w] of AGE_WEIGHTS) expectNear(share(customers, (c) => c.age_band === band), w / 100, POINTS, `age ${band}`);
    for (const [sex, w] of SEX_WEIGHTS) expectNear(share(customers, (c) => c.sex === sex), w / 100, POINTS, `sex ${sex}`);
    for (const [ch, w] of CHANNEL_WEIGHTS) expectNear(share(customers, (c) => c.acquisition_channel === ch), w / 100, POINTS, `channel ${ch}`);
  });

  it("segment priors hold within three points", () => {
    for (const [segment, w] of SEGMENT_PRIORS) {
      expectNear(share(customer_segments, (s) => s.primary_segment === segment), w / 100, POINTS, `segment ${segment}`);
    }
  });

  it("research consent follows the plan", () => {
    for (const plan of ["standalone", "membership_first", "study"] as const) {
      const ofPlan = customers.filter((c) => c.plan === plan);
      expectNear(share(ofPlan, (c) => c.consent_research === true), CONSENT_RESEARCH_RATE[plan], 0.1, `consent ${plan}`);
    }
  });

  it("FL, TX, CA, NY and GA are the top five states", () => {
    const counts = new Map<string, number>();
    for (const c of customers) counts.set(c.region_state, (counts.get(c.region_state) ?? 0) + 1);
    const top5 = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([s]) => s);
    if ([...top5].sort().join() !== ["CA", "FL", "GA", "NY", "TX"].join()) throw new Error(`top five were ${top5.join(", ")}`);
  });
});
