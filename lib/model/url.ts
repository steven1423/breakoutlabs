import { BOUNDS, DEFAULTS, PLANS, type ModelInputs, type Plan } from "./formulas.ts";

/**
 * The calculator's inputs live in the query string so a link can preset them
 * (the timeline sends `plan=membership_first`) and a state can be shared.
 */

const KEYS: Record<Exclude<keyof ModelInputs, "plan" | "retestRate">, string> = {
  newCustomers: "n",
  growth: "g",
  churn: "c",
  takeRate: "t",
  partnerGmvPerYear: "gmv",
  horizon: "h",
  multiple: "x",
};

type Params = { get(key: string): string | null };

export function parseInputs(params: Params): ModelInputs {
  const inputs: ModelInputs = { ...DEFAULTS };
  for (const [field, key] of Object.entries(KEYS) as [keyof typeof KEYS, string][]) {
    const raw = params.get(key);
    const value = raw === null ? NaN : Number(raw);
    if (Number.isFinite(value)) inputs[field] = clamp(value, BOUNDS[field].min, BOUNDS[field].max);
  }
  const plan = params.get("plan");
  if (plan && (PLANS as readonly string[]).includes(plan)) inputs.plan = plan as Plan;
  const retest = params.get("r");
  const retestValue = retest === null ? NaN : Number(retest);
  inputs.retestRate = Number.isFinite(retestValue) ? clamp(retestValue, BOUNDS.retestRate.min, BOUNDS.retestRate.max) : null;
  return inputs;
}

/** Only values that differ from the defaults are written, so a default state is a clean URL. */
export function serializeInputs(inputs: ModelInputs): URLSearchParams {
  const params = new URLSearchParams();
  for (const [field, key] of Object.entries(KEYS) as [keyof typeof KEYS, string][]) {
    if (inputs[field] !== DEFAULTS[field]) params.set(key, trim(inputs[field]));
  }
  if (inputs.plan !== DEFAULTS.plan) params.set("plan", inputs.plan);
  if (inputs.retestRate !== null) params.set("r", trim(inputs.retestRate));
  return params;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function trim(value: number): string {
  return String(Number(value.toFixed(4)));
}
