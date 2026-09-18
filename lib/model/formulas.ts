/**
 * The path-to-$1B calculator (CLAUDE.md §11). Pure: inputs in, one row per month out.
 * Every formula is §11 as written, with three documented additions (docs/DECISIONS.md, M5):
 * retests count three months after the order, brand revenue ramps linearly over months 18–24,
 * and retested members do not churn, so the retest slider reaches the valuation.
 */

export const PLANS = ["standalone", "membership_first", "study"] as const;
export type Plan = (typeof PLANS)[number];

export const PLAN_KIT_PRICE: Record<Plan, number> = { standalone: 249, membership_first: 99, study: 149 };
export const PLAN_JOIN_RATE: Record<Plan, number> = { standalone: 0.25, membership_first: 1, study: 1 };
export const PLAN_RETEST_RATE: Record<Plan, number> = { standalone: 0.22, membership_first: 0.58, study: 0.71 };
export const MEMBERSHIP_PRICE = 49;
export const RETEST_LAG_MONTHS = 3;
export const CHURN_STARTS_AFTER_MONTH = 3;
export const BRAND_RAMP_START = 18;
export const BRAND_RAMP_END = 24;

export type ModelInputs = {
  newCustomers: number;
  growth: number;
  plan: Plan;
  /** null means "use the plan's rate" (§11: 22% / 58% / 71% unless overridden). */
  retestRate: number | null;
  churn: number;
  takeRate: number;
  partnerGmvPerYear: number;
  horizon: number;
  multiple: number;
};

export const DEFAULTS: ModelInputs = {
  newCustomers: 800,
  growth: 0.04,
  plan: "standalone",
  retestRate: null,
  churn: 0.08,
  takeRate: 0.15,
  partnerGmvPerYear: 120,
  horizon: 36,
  multiple: 12,
};

/** Slider bounds. The UI and the URL parser both clamp to these. */
export const BOUNDS = {
  newCustomers: { min: 100, max: 5_000, step: 50 },
  growth: { min: 0, max: 0.15, step: 0.005 },
  retestRate: { min: 0.05, max: 0.9, step: 0.01 },
  churn: { min: 0, max: 0.2, step: 0.005 },
  takeRate: { min: 0, max: 0.4, step: 0.01 },
  partnerGmvPerYear: { min: 0, max: 600, step: 10 },
  horizon: { min: 12, max: 60, step: 1 },
  multiple: { min: 6, max: 25, step: 1 },
} as const;

export type MonthRow = {
  month: number;
  newCustomers: number;
  kitRevenue: number;
  members: number;
  membershipRevenue: number;
  retestedCum: number;
  brandRevenue: number;
  arr: number;
  valuation: number;
};

export type Projection = { rows: MonthRow[]; horizon: MonthRow; retestRate: number };

export function resolveRetestRate(inputs: Pick<ModelInputs, "plan" | "retestRate">): number {
  return inputs.retestRate ?? PLAN_RETEST_RATE[inputs.plan];
}

/** New customers in month m (1-based): the month-1 figure compounded at the growth rate. */
export function newCustomersIn(month: number, inputs: Pick<ModelInputs, "newCustomers" | "growth">): number {
  return inputs.newCustomers * Math.pow(1 + inputs.growth, month - 1);
}

/** Churn is zero for the first three months, then the input rate on the share that has not retested. */
export function effectiveChurn(month: number, churn: number, retestRate: number): number {
  return month <= CHURN_STARTS_AFTER_MONTH ? 0 : churn * (1 - retestRate);
}

/** 0 before month 18, 1 from month 24, linear in between. */
export function brandRamp(month: number): number {
  if (month < BRAND_RAMP_START) return 0;
  if (month >= BRAND_RAMP_END) return 1;
  return (month - BRAND_RAMP_START) / (BRAND_RAMP_END - BRAND_RAMP_START);
}

/** §11 as written: (retested_cum / 12) × partner_gmv_per_year / 12 × take_rate, times the ramp. */
export function brandRevenueIn(month: number, retestedCum: number, inputs: Pick<ModelInputs, "partnerGmvPerYear" | "takeRate">): number {
  return brandRamp(month) * (retestedCum / 12) * (inputs.partnerGmvPerYear / 12) * inputs.takeRate;
}

export function project(inputs: ModelInputs): Projection {
  const retestRate = resolveRetestRate(inputs);
  const rows: MonthRow[] = [];
  let members = 0;
  let retestedCum = 0;
  for (let month = 1; month <= inputs.horizon; month++) {
    const newCustomers = newCustomersIn(month, inputs);
    const kitRevenue = newCustomers * PLAN_KIT_PRICE[inputs.plan];
    members = members * (1 - effectiveChurn(month, inputs.churn, retestRate)) + newCustomers * PLAN_JOIN_RATE[inputs.plan];
    const membershipRevenue = members * MEMBERSHIP_PRICE;
    const retestMonth = month - RETEST_LAG_MONTHS;
    if (retestMonth >= 1) retestedCum += newCustomersIn(retestMonth, inputs) * retestRate;
    const brandRevenue = brandRevenueIn(month, retestedCum, inputs);
    const arr = 12 * (kitRevenue + membershipRevenue + brandRevenue);
    rows.push({ month, newCustomers, kitRevenue, members, membershipRevenue, retestedCum, brandRevenue, arr, valuation: arr * inputs.multiple });
  }
  return { rows, horizon: rows[rows.length - 1], retestRate };
}

/** Valuation at the horizon for each pricing model across a range of retest rates: the thesis as a curve. */
export function sensitivity(inputs: ModelInputs, rates: readonly number[]): { rate: number; byPlan: Record<Plan, number> }[] {
  return rates.map((rate) => ({
    rate,
    byPlan: Object.fromEntries(PLANS.map((plan) => [plan, project({ ...inputs, plan, retestRate: rate }).horizon.valuation])) as Record<Plan, number>,
  }));
}

export type YearRow = { year: number; endMonth: number; newCustomers: number; members: number; retestedCum: number; arr: number; brandRevenueAnnual: number; valuation: number };

/** One row per completed year within the horizon: what the company looks like at month 12, 24, 36. */
export function yearSummary(projection: Projection): YearRow[] {
  const out: YearRow[] = [];
  for (let year = 1; year * 12 <= projection.rows.length; year++) {
    const months = projection.rows.slice((year - 1) * 12, year * 12);
    const end = months[months.length - 1];
    out.push({
      year,
      endMonth: end.month,
      newCustomers: months.reduce((a, r) => a + r.newCustomers, 0),
      members: end.members,
      retestedCum: end.retestedCum,
      arr: end.arr,
      brandRevenueAnnual: end.brandRevenue * 12,
      valuation: end.valuation,
    });
  }
  return out;
}
