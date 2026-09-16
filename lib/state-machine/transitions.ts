import type { Database } from "../db/types.ts";

export type KitState = Database["public"]["Enums"]["kit_state"];
export type Actor = Database["public"]["Enums"]["actor"];

/** The fields the state machine needs. Rows from `kits` satisfy this. */
export type KitLike = { id: string; state: KitState; state_entered_at: string };

export type KitEventDraft = {
  kit_id: string;
  from_state: KitState;
  to_state: KitState;
  at: string;
  actor: Actor;
  note: string | null;
};

/** All sixteen states in lifecycle order (CLAUDE.md §5). */
export const KIT_STATES: readonly KitState[] = [
  "ordered", "backordered", "shipped", "delivered", "registered", "registration_mismatch",
  "sample_received", "resulted", "results_locked", "blueprint_ready", "viewed",
  "checkin_active", "retest_due", "retest_ordered", "cancelled", "refunded",
];

export const TERMINAL_STATES: ReadonlySet<KitState> = new Set(["cancelled", "refunded"]);

/** Where each state may go next (CLAUDE.md §6). Terminal states go nowhere. */
const NEXT: Record<KitState, readonly KitState[]> = {
  ordered: ["shipped", "backordered"],
  backordered: ["shipped"],
  shipped: ["delivered"],
  delivered: ["registered"],
  registered: ["sample_received", "registration_mismatch"],
  registration_mismatch: ["registered"],
  sample_received: ["resulted"],
  resulted: ["blueprint_ready", "results_locked"],
  results_locked: ["resulted"],
  blueprint_ready: ["viewed"],
  viewed: ["checkin_active"],
  checkin_active: ["retest_due"],
  retest_due: ["retest_ordered"],
  retest_ordered: [],
  cancelled: [],
  refunded: [],
};

/** Legal exits for a state, including cancel and refund from any non-terminal state. */
export function legalTransitions(from: KitState): readonly KitState[] {
  if (TERMINAL_STATES.has(from)) return [];
  return [...NEXT[from], "cancelled", "refunded"];
}

export function canTransition(from: KitState, to: KitState): boolean {
  return legalTransitions(from).includes(to);
}

/**
 * Pure transition: returns the updated kit and the event to record. Throws on an illegal move.
 * The database layer (`db.ts`) is the only place that persists the result.
 */
export function transition<K extends KitLike>(kit: K, to: KitState, actor: Actor, note?: string, now: Date = new Date()): { kit: K; event: KitEventDraft } {
  if (!canTransition(kit.state, to)) {
    throw new Error(`Illegal kit transition: ${kit.state} → ${to}`);
  }
  const at = now.toISOString();
  return {
    kit: { ...kit, state: to, state_entered_at: at },
    event: { kit_id: kit.id, from_state: kit.state, to_state: to, at, actor, note: note ?? null },
  };
}
