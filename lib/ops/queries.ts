import type { Database } from "../db/types.ts";
import { createServiceSupabase } from "../db/service.ts";
import { loadSlaHours } from "../state-machine/db.ts";
import { slaStatus, type SlaHours, type SlaStatus } from "../state-machine/sla.ts";
import { KIT_STATES, type KitState } from "../state-machine/transitions.ts";

export type { KitState };
type Tables = Database["public"]["Tables"];

export type KitListRow = {
  id: string;
  kit_code: string;
  sequence_no: number;
  state: KitState;
  state_entered_at: string;
  customer: { first_name: string; plan: Database["public"]["Enums"]["plan_type"] } | null;
  sla: SlaStatus;
};

export type OpsOverview = {
  kits: KitListRow[];
  stuck: KitListRow[];
  retention: KitListRow[];
  countsByState: Record<KitState, number>;
  ticketByKit: Map<string, { id: string; likely_cause: string | null }>;
  sla: SlaHours;
  total: number;
  nowMs: number;
};

/** Everything the /ops page needs in two round trips. */
export async function loadOpsOverview(now: Date = new Date()): Promise<OpsOverview> {
  const db = createServiceSupabase();
  const [sla, kits, tickets] = await Promise.all([
    loadSlaHours(db),
    db.from("kits").select("id, kit_code, sequence_no, state, state_entered_at, customer:customers(first_name, plan)").order("state_entered_at", { ascending: true }),
    db.from("tickets").select("id, kit_id, likely_cause").in("status", ["open", "pending_customer"]),
  ]);
  if (kits.error) throw new Error(kits.error.message);
  if (tickets.error) throw new Error(tickets.error.message);

  const rows: KitListRow[] = kits.data.map((k) => ({ ...k, sla: slaStatus(k, now, sla) }));
  const countsByState = Object.fromEntries(KIT_STATES.map((s) => [s, 0])) as Record<KitState, number>;
  for (const k of rows) countsByState[k.state]++;

  const ticketByKit = new Map<string, { id: string; likely_cause: string | null }>();
  for (const t of tickets.data) if (t.kit_id && !ticketByKit.has(t.kit_id)) ticketByKit.set(t.kit_id, { id: t.id, likely_cause: t.likely_cause });

  const stuck = rows.filter((k) => k.sla.stuck && !k.sla.retention).sort((a, b) => b.sla.hoursOver - a.sla.hoursOver);
  const retention = rows.filter((k) => k.sla.stuck && k.sla.retention);
  return { kits: rows, stuck, retention, countsByState, ticketByKit, sla, total: rows.length, nowMs: now.getTime() };
}

export type KitDetail = {
  kit: Tables["kits"]["Row"];
  customer: Pick<Tables["customers"]["Row"], "id" | "first_name" | "plan" | "email_masked" | "region_state" | "age_band">;
  events: Tables["kit_events"]["Row"][];
  tickets: Pick<Tables["tickets"]["Row"], "id" | "subject" | "status" | "opened_at" | "likely_cause" | "channel">[];
  actions: Pick<Tables["pending_actions"]["Row"], "id" | "type" | "status" | "created_at" | "payload">[];
  sla: SlaStatus;
  slaHours: SlaHours;
  nowMs: number;
};

/** One kit with its whole history. Null when the code does not exist. */
export async function loadKitDetail(kitCode: string, now: Date = new Date()): Promise<KitDetail | null> {
  const db = createServiceSupabase();
  const { data: kit, error } = await db.from("kits").select("*").eq("kit_code", kitCode).maybeSingle();
  if (error) throw new Error(error.message);
  if (!kit) return null;

  const [slaHours, customer, events, tickets, actions] = await Promise.all([
    loadSlaHours(db),
    db.from("customers").select("id, first_name, plan, email_masked, region_state, age_band").eq("id", kit.customer_id).single(),
    db.from("kit_events").select("*").eq("kit_id", kit.id).order("at", { ascending: true }),
    db.from("tickets").select("id, subject, status, opened_at, likely_cause, channel").eq("kit_id", kit.id).order("opened_at", { ascending: false }),
    db.from("pending_actions").select("id, type, status, created_at, payload").eq("customer_id", kit.customer_id).order("created_at", { ascending: false }),
  ]);
  for (const r of [customer, events, tickets, actions]) if (r.error) throw new Error(r.error.message);

  return {
    kit,
    customer: customer.data!,
    events: events.data!,
    tickets: tickets.data!,
    actions: actions.data!,
    sla: slaStatus(kit, now, slaHours),
    slaHours,
    nowMs: now.getTime(),
  };
}

/** Whole hours a kit has been in its current state. */
export function hoursInState(stateEnteredAt: string, now: number = Date.now()): number {
  return Math.max(0, Math.floor((now - Date.parse(stateEnteredAt)) / 3_600_000));
}

export function humanise(value: string): string {
  const spaced = value.replace(/_/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export type PendingActionRow = {
  id: string;
  type: string;
  status: string;
  proposed_by: string;
  created_at: string;
  payload: unknown;
  customer: { first_name: string } | null;
};

export type Paged<T> = { rows: T[]; total: number };

/** One page of proposals, newest first, plus how many are still waiting for a decision. */
export async function listPendingActions(page = 1, size = 25): Promise<Paged<PendingActionRow>> {
  const db = createServiceSupabase();
  const from = (page - 1) * size;
  const { data, error, count } = await db
    .from("pending_actions")
    .select("id, type, status, proposed_by, created_at, payload, customer:customers(first_name)", { count: "exact" })
    .eq("status", "proposed")
    .order("created_at", { ascending: false })
    .range(from, from + size - 1);
  if (error) throw new Error(error.message);
  return { rows: data, total: count ?? 0 };
}

export type OpenTicketRow = {
  id: string;
  subject: string;
  channel: string;
  status: string;
  opened_at: string;
  likely_cause: string | null;
  customer: { first_name: string } | null;
  kit: { kit_code: string; state: KitState } | null;
};

/** One page of tickets that still need someone, oldest first so the longest wait is on top. */
export async function listOpenTickets(page = 1, size = 25): Promise<Paged<OpenTicketRow>> {
  const db = createServiceSupabase();
  const from = (page - 1) * size;
  const { data, error, count } = await db
    .from("tickets")
    .select("id, subject, channel, status, opened_at, likely_cause, customer:customers(first_name), kit:kits(kit_code, state)", { count: "exact" })
    .in("status", ["open", "pending_customer"])
    .order("opened_at", { ascending: true })
    .range(from, from + size - 1);
  if (error) throw new Error(error.message);
  return { rows: data as OpenTicketRow[], total: count ?? 0 };
}

/** The counts the /ops headline needs beyond the kits themselves. */
export async function loadOpsCounts(): Promise<{ openTickets: number; proposed: number; decidedToday: number }> {
  const db = createServiceSupabase();
  const dayAgo = new Date(Date.now() - 86_400_000).toISOString();
  const [tickets, proposed, decided] = await Promise.all([
    db.from("tickets").select("*", { count: "exact", head: true }).in("status", ["open", "pending_customer"]),
    db.from("pending_actions").select("*", { count: "exact", head: true }).eq("status", "proposed"),
    db.from("pending_actions").select("*", { count: "exact", head: true }).neq("status", "proposed").gte("decided_at", dayAgo),
  ]);
  for (const r of [tickets, proposed, decided]) if (r.error) throw new Error(r.error.message);
  return { openTickets: tickets.count ?? 0, proposed: proposed.count ?? 0, decidedToday: decided.count ?? 0 };
}

/** Median of a list, for "typical hours in state". */
export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export type TicketDetail = {
  ticket: Pick<Tables["tickets"]["Row"], "id" | "subject" | "body" | "status" | "channel" | "opened_at" | "likely_cause" | "ai_summary">;
  customer: Pick<Tables["customers"]["Row"], "id" | "first_name" | "email_masked" | "plan"> | null;
  kit: Pick<Tables["kits"]["Row"], "kit_code" | "state" | "state_entered_at"> | null;
};

export async function loadTicketDetail(id: string): Promise<TicketDetail | null> {
  const db = createServiceSupabase();
  const { data, error } = await db
    .from("tickets")
    .select("id, subject, body, status, channel, opened_at, likely_cause, ai_summary, customer:customers(id, first_name, email_masked, plan), kit:kits(kit_code, state, state_entered_at)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const { customer, kit, ...ticket } = data;
  return { ticket, customer, kit };
}
