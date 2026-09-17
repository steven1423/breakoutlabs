import type { Database } from "../db/types.ts";
import { hoursInState, isRetention, isStuck, stuckReason, type LikelyCause, type SlaHours } from "./sla.ts";
import type { KitLike, KitState } from "./transitions.ts";

type ActionType = Database["public"]["Enums"]["action_type"];

export type SweepKit = KitLike & { kit_code: string; customer_id: string };
export type SweepTicket = { id: string; kit_id: string | null; likely_cause: LikelyCause | null };
export type SweepProposal = { customer_id: string; payload: unknown };

export type TicketDraft = {
  customer_id: string;
  kit_id: string;
  channel: "system";
  subject: string;
  body: string;
  status: "open";
  opened_at: string;
  likely_cause: LikelyCause;
};

export type NudgePayload = { kit_code: string; state: KitState; cause: LikelyCause; hours_over: number; message: string };

export type NudgeDraft = {
  type: ActionType;
  customer_id: string;
  payload: NudgePayload;
  proposed_by: "sweep";
  status: "proposed";
  created_at: string;
};

export type SweepPlan = {
  stuck: SweepKit[];
  retention: SweepKit[];
  ticketsToOpen: TicketDraft[];
  causesToSet: { ticketId: string; cause: LikelyCause }[];
  nudgesToPropose: NudgeDraft[];
};

/**
 * Decides what a sweep should write, without writing anything.
 * Idempotent by construction: a kit with an open ticket and a proposed nudge produces nothing.
 * Retention states (viewed, retest_due) get a nudge but never a support ticket.
 */
export function planSweep(kits: readonly SweepKit[], openTickets: readonly SweepTicket[], proposals: readonly SweepProposal[], now: Date, sla?: SlaHours): SweepPlan {
  const plan: SweepPlan = { stuck: [], retention: [], ticketsToOpen: [], causesToSet: [], nudgesToPropose: [] };
  const ticketsByKit = new Map<string, SweepTicket[]>();
  for (const t of openTickets) {
    if (t.kit_id) ticketsByKit.set(t.kit_id, [...(ticketsByKit.get(t.kit_id) ?? []), t]);
  }
  const nudgedCodes = new Set(proposals.map((p) => kitCodeOf(p.payload)).filter((c): c is string => c !== null));

  for (const kit of kits) {
    if (!isStuck(kit, now, sla)) continue;
    const cause = stuckReason(kit);
    const retention = isRetention(kit);
    (retention ? plan.retention : plan.stuck).push(kit);

    if (!retention) {
      const existing = ticketsByKit.get(kit.id) ?? [];
      if (existing.length === 0) plan.ticketsToOpen.push(ticketFor(kit, cause, now));
      for (const t of existing) if (t.likely_cause === null) plan.causesToSet.push({ ticketId: t.id, cause });
    }
    if (!nudgedCodes.has(kit.kit_code)) plan.nudgesToPropose.push(nudgeFor(kit, cause, now, sla));
  }
  return plan;
}

function ticketFor(kit: SweepKit, cause: LikelyCause, now: Date): TicketDraft {
  return {
    customer_id: kit.customer_id,
    kit_id: kit.id,
    channel: "system",
    subject: `Kit ${kit.kit_code} stuck in ${kit.state.replace(/_/g, " ")}`,
    body: `Opened by the stuck-kit sweep. ${kit.kit_code} entered ${kit.state} at ${kit.state_entered_at} and has passed its SLA. Likely cause: ${cause}.`,
    status: "open",
    opened_at: now.toISOString(),
    likely_cause: cause,
  };
}

function nudgeFor(kit: SweepKit, cause: LikelyCause, now: Date, sla?: SlaHours): NudgeDraft {
  const hoursOver = Math.floor(hoursInState(kit, now) - (sla?.[kit.state] ?? 0));
  return {
    type: nudgeTypeFor(cause),
    customer_id: kit.customer_id,
    payload: { kit_code: kit.kit_code, state: kit.state, cause, hours_over: hoursOver, message: nudgeMessage(kit.state) },
    proposed_by: "sweep",
    status: "proposed",
    created_at: now.toISOString(),
  };
}

/** Shipping problems get a text; everything else gets an email with a link. */
export function nudgeTypeFor(cause: LikelyCause): ActionType {
  return cause === "shipping_delay" || cause === "backorder" ? "nudge_sms" : "nudge_email";
}

const NUDGE_MESSAGE: Partial<Record<KitState, string>> = {
  results_locked: "Your results are ready. We fixed the link on our side; sign in and they will be there.",
  resulted: "Your results are ready to view. Sign in to see your panel and next steps.",
  blueprint_ready: "Your Clear Skin Blueprint is ready. Sign in to read it.",
  registration_mismatch: "We could not match your kit registration to your order. Reply and we will fix it in a minute.",
  backordered: "Your kit is delayed on our side. It ships this week and we will text you the tracking number.",
  shipped: "Your kit is taking longer than usual to arrive. We are checking with the carrier and will update you.",
  delivered: "Your kit has arrived. Register it when you are ready and collect on a morning that suits you.",
  viewed: "How is the plan going? Log a quick check-in so your specialist can adjust it.",
  retest_due: "It has been 90 days. Your retest is the part that shows what changed. Order it when you are ready.",
};

function nudgeMessage(state: KitState): string {
  return NUDGE_MESSAGE[state] ?? "Checking in on your kit. Reply if you need anything.";
}

function kitCodeOf(payload: unknown): string | null {
  if (payload && typeof payload === "object" && "kit_code" in payload && typeof payload.kit_code === "string") return payload.kit_code;
  return null;
}
