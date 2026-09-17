import type { Database } from "../db/types.ts";
import type { KitLike, KitState } from "./transitions.ts";

export type LikelyCause = Database["public"]["Enums"]["likely_cause"];
export type SlaHours = Partial<Record<KitState, number>>;

const HOUR_MS = 3_600_000;

/** Hours a kit may sit in a state before it is stuck (CLAUDE.md §6). Stored in settings.sla_hours too. */
export const DEFAULT_SLA_HOURS: SlaHours = {
  ordered: 48,
  backordered: 72,
  shipped: 168,
  delivered: 240,
  registered: 240,
  registration_mismatch: 24,
  sample_received: 168,
  resulted: 72,
  results_locked: 24,
  blueprint_ready: 72,
  viewed: 336,
  retest_due: 336,
};

/** Likely cause when a kit is stuck in each state (CLAUDE.md §6). */
export const STUCK_CAUSE: Partial<Record<KitState, LikelyCause>> = {
  ordered: "backorder",
  backordered: "backorder",
  shipped: "shipping_delay",
  delivered: "unlinked_kit",
  registered: "shipping_delay",
  registration_mismatch: "registration_mismatch",
  sample_received: "other",
  resulted: "portal_lockout",
  results_locked: "portal_lockout",
  blueprint_ready: "portal_lockout",
  viewed: "other",
  retest_due: "other",
};

/**
 * Stuck here means the customer went quiet, not that ops dropped something.
 * These get nudges, not support tickets (docs/DECISIONS.md, M2).
 */
export const RETENTION_STATES: ReadonlySet<KitState> = new Set(["viewed", "retest_due"]);

export function hoursInState(kit: KitLike, now: Date = new Date()): number {
  return Math.max(0, (now.getTime() - Date.parse(kit.state_entered_at)) / HOUR_MS);
}

/** Strictly past the SLA. Exactly at the SLA is not stuck; states without an SLA never are. */
export function isStuck(kit: KitLike, now: Date = new Date(), sla: SlaHours = DEFAULT_SLA_HOURS): boolean {
  const limit = sla[kit.state];
  if (limit === undefined) return false;
  return hoursInState(kit, now) > limit;
}

export function stuckReason(kit: KitLike): LikelyCause {
  return STUCK_CAUSE[kit.state] ?? "other";
}

export function isRetention(kit: KitLike): boolean {
  return RETENTION_STATES.has(kit.state);
}

export type SlaStatus = {
  slaHours: number | null;
  hoursIn: number;
  hoursOver: number;
  stuck: boolean;
  retention: boolean;
  cause: LikelyCause | null;
};

/** Everything the UI shows about a kit's clock. */
export function slaStatus(kit: KitLike, now: Date = new Date(), sla: SlaHours = DEFAULT_SLA_HOURS): SlaStatus {
  const slaHours = sla[kit.state] ?? null;
  const hoursIn = hoursInState(kit, now);
  const stuck = isStuck(kit, now, sla);
  return {
    slaHours,
    hoursIn,
    hoursOver: slaHours === null ? 0 : Math.max(0, hoursIn - slaHours),
    stuck,
    retention: isRetention(kit),
    cause: stuck ? stuckReason(kit) : null,
  };
}

/** Merges a settings override (partial, possibly malformed) over the defaults. */
export function mergeSlaHours(override: unknown): SlaHours {
  const merged: SlaHours = { ...DEFAULT_SLA_HOURS };
  if (override && typeof override === "object") {
    for (const [state, hours] of Object.entries(override)) {
      if (typeof hours === "number" && hours > 0 && state in DEFAULT_SLA_HOURS) merged[state as KitState] = hours;
    }
  }
  return merged;
}
