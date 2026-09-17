import { createServiceSupabase, type ServiceClient } from "../db/service.ts";
import { normaliseMinCohort } from "./guard.ts";

export const DEFAULT_MIN_COHORT = 50;

/** settings.min_cohort, else MIN_COHORT from the environment, else 50. */
export async function loadMinCohort(db: ServiceClient = createServiceSupabase()): Promise<number> {
  const { data, error } = await db.from("settings").select("value").eq("key", "min_cohort").maybeSingle();
  if (error) throw new Error(error.message);
  if (data && data.value !== null) return normaliseMinCohort(data.value, DEFAULT_MIN_COHORT);
  return normaliseMinCohort(process.env.MIN_COHORT, DEFAULT_MIN_COHORT);
}

export async function saveMinCohort(value: unknown, db: ServiceClient = createServiceSupabase()): Promise<number> {
  const n = normaliseMinCohort(value, DEFAULT_MIN_COHORT);
  const { error } = await db.from("settings").upsert({ key: "min_cohort", value: n });
  if (error) throw new Error(error.message);
  return n;
}
