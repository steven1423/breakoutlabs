"use server";

import { revalidatePath } from "next/cache";
import { sweepStuckKits, applyTransition, type SweepResult } from "@/lib/state-machine/db";
import { canTransition, type KitState } from "@/lib/state-machine/transitions";
import { STAFF_FIXES } from "@/lib/ops/fixes";

export type SweepState = { result: SweepResult | null; error: string | null };

/** Server action behind the "Run sweep" button. */
export async function runSweepAction(): Promise<SweepState> {
  try {
    const result = await sweepStuckKits();
    revalidatePath("/ops");
    return { result, error: null };
  } catch (err) {
    return { result: null, error: err instanceof Error ? err.message : "Sweep failed" };
  }
}

export async function staffFixAction(formData: FormData): Promise<void> {
  const kitCode = String(formData.get("kit_code") ?? "");
  const from = String(formData.get("from") ?? "") as KitState;
  const fix = STAFF_FIXES[from];
  if (!fix || !canTransition(from, fix.to)) throw new Error(`No staff fix from ${from}`);
  await applyTransition(kitCode, fix.to, "staff", fix.note);
  revalidatePath(`/ops/kits/${kitCode}`);
  revalidatePath("/ops");
}
