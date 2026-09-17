import { createServiceSupabase, type ServiceClient } from "../db/service.ts";
import { mergeSlaHours, type SlaHours } from "./sla.ts";
import { planSweep, type SweepKit, type SweepPlan } from "./sweep.ts";
import { transition, type Actor, type KitState } from "./transitions.ts";

/** SLA hours from settings, merged over the §6 defaults. */
export async function loadSlaHours(db: ServiceClient = createServiceSupabase()): Promise<SlaHours> {
  const { data } = await db.from("settings").select("value").eq("key", "sla_hours").maybeSingle();
  return mergeSlaHours(data?.value);
}

/**
 * The one place a kit changes state. Runs the pure transition, then writes the kit and its event.
 * Throws on an illegal move or an unknown kit code.
 */
export async function applyTransition(kitCode: string, to: KitState, actor: Actor, note?: string, now: Date = new Date()) {
  const db = createServiceSupabase();
  const { data: kit, error } = await db.from("kits").select("id, state, state_entered_at").eq("kit_code", kitCode).maybeSingle();
  if (error) throw new Error(error.message);
  if (!kit) throw new Error(`Unknown kit ${kitCode}`);

  const result = transition(kit, to, actor, note, now);
  const event = await db.from("kit_events").insert(result.event);
  if (event.error) throw new Error(event.error.message);
  const update = await db.from("kits").update({ state: result.kit.state, state_entered_at: result.kit.state_entered_at }).eq("id", kit.id);
  if (update.error) throw new Error(update.error.message);
  return result;
}

export type SweepResult = {
  stuck: number;
  retention: number;
  ticketsOpened: number;
  causesSet: number;
  nudgesProposed: number;
};

/**
 * Finds stuck kits, opens one ticket per ops-stuck kit that has none, classifies open
 * unclassified tickets, and proposes one nudge per stuck kit. Safe to run repeatedly.
 */
export async function sweepStuckKits(now: Date = new Date()): Promise<SweepResult> {
  const db = createServiceSupabase();
  const sla = await loadSlaHours(db);
  const plan = await buildPlan(db, now, sla);
  await writePlan(db, plan);
  return {
    stuck: plan.stuck.length,
    retention: plan.retention.length,
    ticketsOpened: plan.ticketsToOpen.length,
    causesSet: plan.causesToSet.length,
    nudgesProposed: plan.nudgesToPropose.length,
  };
}

async function buildPlan(db: ServiceClient, now: Date, sla: SlaHours): Promise<SweepPlan> {
  const kits = await db.from("kits").select("id, kit_code, customer_id, state, state_entered_at");
  if (kits.error) throw new Error(kits.error.message);
  const tickets = await db.from("tickets").select("id, kit_id, likely_cause").in("status", ["open", "pending_customer"]);
  if (tickets.error) throw new Error(tickets.error.message);
  const proposals = await db.from("pending_actions").select("customer_id, payload").eq("status", "proposed").in("type", ["nudge_sms", "nudge_email"]);
  if (proposals.error) throw new Error(proposals.error.message);
  return planSweep(kits.data as SweepKit[], tickets.data, proposals.data, now, sla);
}

async function writePlan(db: ServiceClient, plan: SweepPlan): Promise<void> {
  if (plan.ticketsToOpen.length > 0) {
    const { error } = await db.from("tickets").insert(plan.ticketsToOpen);
    if (error) throw new Error(error.message);
  }
  for (const { ticketId, cause } of plan.causesToSet) {
    const { error } = await db.from("tickets").update({ likely_cause: cause }).eq("id", ticketId);
    if (error) throw new Error(error.message);
  }
  if (plan.nudgesToPropose.length > 0) {
    const { error } = await db.from("pending_actions").insert(plan.nudgesToPropose);
    if (error) throw new Error(error.message);
  }
}
