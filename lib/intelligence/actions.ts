"use server";

import { revalidatePath } from "next/cache";
import { saveMinCohort } from "./settings.ts";

export type MinCohortState = { value: number | null; error: string | null };

/** The one write on the intelligence page: the minimum cohort setting. */
export async function setMinCohortAction(_prev: MinCohortState, formData: FormData): Promise<MinCohortState> {
  try {
    const value = await saveMinCohort(formData.get("min_cohort"));
    revalidatePath("/intelligence");
    revalidatePath("/brand");
    return { value, error: null };
  } catch (err) {
    return { value: null, error: err instanceof Error ? err.message : "Could not save" };
  }
}
