import { describe, expect, it } from "vitest";
import { KIT_STATES, TERMINAL_STATES, canTransition, legalTransitions, transition, type KitState } from "@/lib/state-machine/transitions";

/** The §6 table, written out so the test does not trust the implementation's own map. */
const EXPECTED: Record<KitState, KitState[]> = {
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

const kit = (state: KitState) => ({ id: "kit-1", state, state_entered_at: "2026-09-01T00:00:00.000Z" });

describe("kit transitions", () => {
  it("covers all sixteen states", () => {
    expect(KIT_STATES.length).toBe(16);
    expect(Object.keys(EXPECTED).sort()).toEqual([...KIT_STATES].sort());
  });

  it("allows every legal pair and produces the right event", () => {
    const now = new Date("2026-09-16T12:00:00.000Z");
    for (const from of KIT_STATES) {
      const legal: KitState[] = TERMINAL_STATES.has(from) ? [] : [...EXPECTED[from], "cancelled", "refunded"];
      expect(legalTransitions(from), from).toEqual(legal);
      for (const to of legal) {
        expect(canTransition(from, to), `${from} → ${to}`).toBe(true);
        const result = transition(kit(from), to, "staff", "note", now);
        expect(result.kit.state).toBe(to);
        expect(result.kit.state_entered_at).toBe(now.toISOString());
        expect(result.event).toEqual({ kit_id: "kit-1", from_state: from, to_state: to, at: now.toISOString(), actor: "staff", note: "note" });
      }
    }
  });

  it("throws on every illegal pair, naming both states", () => {
    let illegal = 0;
    for (const from of KIT_STATES) {
      const legal = new Set(legalTransitions(from));
      for (const to of KIT_STATES) {
        if (legal.has(to)) continue;
        illegal++;
        expect(canTransition(from, to)).toBe(false);
        expect(() => transition(kit(from), to, "system")).toThrow(`${from} → ${to}`);
      }
    }
    expect(illegal).toBeGreaterThan(200);
  });

  it("gives terminal states no exits", () => {
    for (const state of TERMINAL_STATES) expect(legalTransitions(state)).toEqual([]);
  });

  it("does not mutate the input kit", () => {
    const original = kit("ordered");
    transition(original, "shipped", "system");
    expect(original.state).toBe("ordered");
  });
});
