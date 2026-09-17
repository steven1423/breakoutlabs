import { describe, expect, it } from "vitest";
import { DEFAULT_SLA_HOURS, STUCK_CAUSE, hoursInState, isStuck, mergeSlaHours, slaStatus, stuckReason } from "@/lib/state-machine/sla";
import { KIT_STATES, type KitState } from "@/lib/state-machine/transitions";

const HOUR = 3_600_000;
const entered = new Date("2026-09-10T00:00:00.000Z");
const kitIn = (state: KitState) => ({ id: "k", state, state_entered_at: entered.toISOString() });

describe("SLA boundary", () => {
  it("is not stuck exactly at the SLA and is stuck one millisecond past it", () => {
    for (const [state, hours] of Object.entries(DEFAULT_SLA_HOURS) as [KitState, number][]) {
      const atLimit = new Date(entered.getTime() + hours * HOUR);
      expect(isStuck(kitIn(state), atLimit), `${state} at limit`).toBe(false);
      expect(isStuck(kitIn(state), new Date(atLimit.getTime() + 1)), `${state} past limit`).toBe(true);
    }
  });

  it("never marks states without an SLA as stuck", () => {
    for (const state of ["checkin_active", "retest_ordered", "cancelled", "refunded"] as const) {
      expect(isStuck(kitIn(state), new Date(entered.getTime() + 10_000 * HOUR))).toBe(false);
    }
  });

  it("honours an override from settings and ignores junk in it", () => {
    const sla = mergeSlaHours({ results_locked: 100, shipped: "soon", nonsense: 5, viewed: -1 });
    expect(sla.results_locked).toBe(100);
    expect(sla.shipped).toBe(DEFAULT_SLA_HOURS.shipped);
    expect(sla.viewed).toBe(DEFAULT_SLA_HOURS.viewed);
    const now = new Date(entered.getTime() + 50 * HOUR);
    expect(isStuck(kitIn("results_locked"), now)).toBe(true);
    expect(isStuck(kitIn("results_locked"), now, sla)).toBe(false);
  });

  it("reports hours in state and hours over", () => {
    const now = new Date(entered.getTime() + 30 * HOUR);
    expect(hoursInState(kitIn("results_locked"), now)).toBe(30);
    const status = slaStatus(kitIn("results_locked"), now);
    expect(status).toEqual({ slaHours: 24, hoursIn: 30, hoursOver: 6, stuck: true, retention: false, cause: "portal_lockout" });
    expect(slaStatus(kitIn("retest_ordered"), now).slaHours).toBeNull();
  });

  it("maps every state to the §6 likely cause", () => {
    const expected: Partial<Record<KitState, string>> = {
      ordered: "backorder", backordered: "backorder", shipped: "shipping_delay", delivered: "unlinked_kit",
      registered: "shipping_delay", registration_mismatch: "registration_mismatch", sample_received: "other",
      resulted: "portal_lockout", results_locked: "portal_lockout", blueprint_ready: "portal_lockout",
      viewed: "other", retest_due: "other",
    };
    for (const state of KIT_STATES) expect(stuckReason(kitIn(state)), state).toBe(expected[state] ?? "other");
    expect(Object.keys(STUCK_CAUSE).sort()).toEqual(Object.keys(DEFAULT_SLA_HOURS).sort());
  });
});
