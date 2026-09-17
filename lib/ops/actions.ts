"use server";

import { revalidatePath } from "next/cache";
import { sweepStuckKits, applyTransition, type SweepResult } from "@/lib/state-machine/db";
import { canTransition, type KitState } from "@/lib/state-machine/transitions";
import { createServiceSupabase } from "@/lib/db/service";
import { createCopilot } from "@/lib/copilot";
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

/** Confirm or reject a proposed action. Recording the decision is the whole action; no send exists (cut list). */
export async function decideActionAction(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  const decision = String(formData.get("decision") ?? "");
  if (decision !== "confirmed" && decision !== "rejected") throw new Error("Decision must be confirmed or rejected");
  const db = createServiceSupabase();
  const { error } = await db.from("pending_actions").update({ status: decision, decided_at: new Date().toISOString() }).eq("id", id).eq("status", "proposed");
  if (error) throw new Error(error.message);
  revalidatePath("/ops");
}

/** Generates (or returns the cached) AI summary for a ticket. */
export async function summarizeTicketAction(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  await createCopilot().summarize(id);
  revalidatePath(`/ops/tickets/${id}`);
}
