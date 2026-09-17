import { describe, expect, it } from "vitest";
import { DEMO_FIRST_NAME, DEMO_KIT_CODE, HOUR_MS, TODAY_MS } from "@/lib/synthetic/constants";
import { dataset, expectNear, share } from "./helpers";

const SLA_SHIPPED_HOURS = 168;
const SLA_LOCKED_HOURS = 24;

describe("kits and events", () => {
  const d = dataset();
  const baseline = d.kits.filter((k) => k.sequence_no === 1);
  const hoursAgo = (iso: string) => (TODAY_MS - Date.parse(iso)) / HOUR_MS;

  it("has one baseline kit per customer and unique codes", () => {
    expect(baseline.length).toBe(d.customers.length);
    expect(new Set(d.kits.map((k) => k.kit_code)).size).toBe(d.kits.length);
    for (const k of d.kits) expect(k.kit_code).toMatch(/^BL-\d{4}-[A-Z]{2}$/);
  });

  it("every kit's last event matches its state and entered time", () => {
    for (const k of d.kits) {
      const events = d.kit_events.filter((e) => e.kit_id === k.id);
      const last = events[events.length - 1];
      expect(last.to_state, k.kit_code).toBe(k.state);
      expect(last.at, k.kit_code).toBe(k.state_entered_at);
      expect(events[0].from_state).toBeNull();
      for (let i = 1; i < events.length; i++) expect(events[i].from_state).toBe(events[i - 1].to_state);
    }
  });

  it("about 8% of baseline kits are stuck right now, in the §12 mix", () => {
    expectNear(share(baseline, (k) => k.state === "results_locked"), 0.03, 0.01, "results_locked");
    expectNear(share(baseline, (k) => k.state === "backordered"), 0.02, 0.01, "backordered");
    expectNear(share(baseline, (k) => k.state === "registration_mismatch"), 0.01, 0.006, "registration_mismatch");
    expectNear(share(baseline, (k) => k.state === "shipped" && hoursAgo(k.state_entered_at) > SLA_SHIPPED_HOURS), 0.02, 0.01, "shipped past SLA");
  });

  it("reserves BL-4471-XK for the demo: results_locked, past SLA, owned by Marissa", () => {
    const kit = d.kits.find((k) => k.kit_code === DEMO_KIT_CODE)!;
    expect(kit.state).toBe("results_locked");
    expect(hoursAgo(kit.state_entered_at)).toBeGreaterThan(SLA_LOCKED_HOURS);
    expect(d.customers.find((c) => c.id === kit.customer_id)!.first_name).toBe(DEMO_FIRST_NAME);
    expect(d.tickets.some((t) => t.kit_id === kit.id && t.status === "open")).toBe(true);
  });

  it("retest kits carry sequence_no 2 and follow a retest_ordered baseline", () => {
    for (const k of d.kits.filter((k) => k.sequence_no === 2)) {
      const first = baseline.find((b) => b.customer_id === k.customer_id)!;
      expect(first.state).toBe("retest_ordered");
    }
  });

  it("seeds about sixty tickets with original text tied to real kits", () => {
    expect(d.tickets.length).toBeGreaterThanOrEqual(55);
    expect(d.tickets.length).toBeLessThanOrEqual(70);
    const kitIds = new Set(d.kits.map((k) => k.id));
    for (const t of d.tickets) {
      expect(kitIds.has(t.kit_id!)).toBe(true);
      expect(t.body.length).toBeGreaterThan(40);
    }
  });
});
