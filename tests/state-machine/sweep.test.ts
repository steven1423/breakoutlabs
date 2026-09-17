import { describe, expect, it } from "vitest";
import { nudgeTypeFor, planSweep, type SweepKit, type SweepProposal, type SweepTicket } from "@/lib/state-machine/sweep";

const HOUR = 3_600_000;
const now = new Date("2026-09-16T12:00:00.000Z");
const ago = (hours: number) => new Date(now.getTime() - hours * HOUR).toISOString();

const kits: SweepKit[] = [
  { id: "k1", kit_code: "BL-0001-AA", customer_id: "c1", state: "results_locked", state_entered_at: ago(96) },
  { id: "k2", kit_code: "BL-0002-BB", customer_id: "c2", state: "backordered", state_entered_at: ago(100) },
  { id: "k3", kit_code: "BL-0003-CC", customer_id: "c3", state: "shipped", state_entered_at: ago(10) },
  { id: "k4", kit_code: "BL-0004-DD", customer_id: "c4", state: "retest_due", state_entered_at: ago(1000) },
  { id: "k5", kit_code: "BL-0005-EE", customer_id: "c5", state: "checkin_active", state_entered_at: ago(5000) },
];

/** Applies a plan to an in-memory store, the way db.ts would. */
function apply(plan: ReturnType<typeof planSweep>, tickets: SweepTicket[], proposals: SweepProposal[]) {
  plan.ticketsToOpen.forEach((t, i) => tickets.push({ id: `t-new-${i}`, kit_id: t.kit_id, likely_cause: t.likely_cause }));
  for (const c of plan.causesToSet) tickets.find((t) => t.id === c.ticketId)!.likely_cause = c.cause;
  for (const n of plan.nudgesToPropose) proposals.push({ customer_id: n.customer_id, payload: n.payload });
}

describe("planSweep", () => {
  it("opens one ticket per ops-stuck kit and one nudge per stuck kit, retention included", () => {
    const plan = planSweep(kits, [], [], now);
    expect(plan.stuck.map((k) => k.id)).toEqual(["k1", "k2"]);
    expect(plan.retention.map((k) => k.id)).toEqual(["k4"]);
    expect(plan.ticketsToOpen.map((t) => t.kit_id)).toEqual(["k1", "k2"]);
    expect(plan.ticketsToOpen[0].likely_cause).toBe("portal_lockout");
    expect(plan.ticketsToOpen[1].likely_cause).toBe("backorder");
    expect(plan.nudgesToPropose.map((n) => n.payload.kit_code)).toEqual(["BL-0001-AA", "BL-0002-BB", "BL-0004-DD"]);
    expect(plan.nudgesToPropose.map((n) => n.type)).toEqual(["nudge_email", "nudge_sms", "nudge_email"]);
    expect(plan.causesToSet).toEqual([]);
  });

  it("is idempotent: applying the plan and planning again yields nothing", () => {
    const tickets: SweepTicket[] = [];
    const proposals: SweepProposal[] = [];
    apply(planSweep(kits, tickets, proposals, now), tickets, proposals);
    const second = planSweep(kits, tickets, proposals, now);
    expect(second.ticketsToOpen).toEqual([]);
    expect(second.causesToSet).toEqual([]);
    expect(second.nudgesToPropose).toEqual([]);
    expect(second.stuck.length).toBe(2);
    expect(tickets.length).toBe(2);
    expect(proposals.length).toBe(3);
  });

  it("classifies an open unclassified ticket instead of opening a second one", () => {
    const tickets: SweepTicket[] = [{ id: "t-customer", kit_id: "k1", likely_cause: null }];
    const plan = planSweep(kits, tickets, [], now);
    expect(plan.ticketsToOpen.map((t) => t.kit_id)).toEqual(["k2"]);
    expect(plan.causesToSet).toEqual([{ ticketId: "t-customer", cause: "portal_lockout" }]);
  });

  it("opens a new ticket when the only ticket is not open (resolved tickets are not passed in)", () => {
    const plan = planSweep(kits, [{ id: "t-other", kit_id: "k9", likely_cause: null }], [], now);
    expect(plan.ticketsToOpen.map((t) => t.kit_id)).toEqual(["k1", "k2"]);
  });

  it("recognises an existing proposal by the kit code in its payload", () => {
    const proposals: SweepProposal[] = [{ customer_id: "c1", payload: { kit_code: "BL-0001-AA" } }, { customer_id: "c2", payload: "garbage" }];
    const plan = planSweep(kits, [], proposals, now);
    expect(plan.nudgesToPropose.map((n) => n.payload.kit_code)).toEqual(["BL-0002-BB", "BL-0004-DD"]);
  });

  it("maps shipping causes to sms and the rest to email", () => {
    expect(nudgeTypeFor("shipping_delay")).toBe("nudge_sms");
    expect(nudgeTypeFor("backorder")).toBe("nudge_sms");
    expect(nudgeTypeFor("portal_lockout")).toBe("nudge_email");
    expect(nudgeTypeFor("other")).toBe("nudge_email");
  });
});
