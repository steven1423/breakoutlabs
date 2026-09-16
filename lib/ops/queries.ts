import type { Database } from "@/lib/db/types";
import { createServiceSupabase } from "@/lib/db/server";

export type KitState = Database["public"]["Enums"]["kit_state"];

export type KitListRow = {
  id: string;
  kit_code: string;
  sequence_no: number;
  state: KitState;
  state_entered_at: string;
  customer: { first_name: string; plan: Database["public"]["Enums"]["plan_type"] } | null;
};

export type KitList = {
  rows: KitListRow[];
  countsByState: Partial<Record<KitState, number>>;
  total: number;
};

/** States that need a human, listed before everything else. */
export const EXCEPTION_STATES: ReadonlySet<KitState> = new Set([
  "results_locked", "registration_mismatch", "backordered", "cancelled", "refunded",
]);

/** Exception states first, then whichever kits have sat longest in their state. */
export async function listKits(limit = 100): Promise<KitList> {
  const db = createServiceSupabase();
  const { data, error } = await db
    .from("kits")
    .select("id, kit_code, sequence_no, state, state_entered_at, customer:customers(first_name, plan)")
    .order("state_entered_at", { ascending: true });
  if (error) throw new Error(error.message);

  const countsByState: Partial<Record<KitState, number>> = {};
  for (const { state } of data) countsByState[state] = (countsByState[state] ?? 0) + 1;

  const rows = [...data].sort((a, b) => rank(a.state) - rank(b.state)).slice(0, limit);
  return { rows, countsByState, total: data.length };
}

function rank(state: KitState): number {
  return EXCEPTION_STATES.has(state) ? 0 : 1;
}

/** Whole hours a kit has been in its current state. */
export function hoursInState(stateEnteredAt: string, now: number = Date.now()): number {
  return Math.max(0, Math.floor((now - Date.parse(stateEnteredAt)) / 3_600_000));
}
