import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import type { ServiceClient } from "../db/service.ts";
import type { Database } from "../db/types.ts";
import { loadSlaHours } from "../state-machine/db.ts";
import { isRetention, isStuck, slaStatus, stuckReason, type SlaHours } from "../state-machine/sla.ts";
import { KIT_STATES, type KitState } from "../state-machine/transitions.ts";
import { guardSql } from "./guard.ts";

type Enums = Database["public"]["Enums"];
const DAY_MS = 86_400_000;
const ROW_CAP = 200;
const QUERY_TIMEOUT_MS = 5000;
/** Bytes a raw query may hand back. The row cap alone does not bound size: one aggregating select is one row. */
export const RESULT_BYTE_CAP = 131_072;

/** What every tool hands back. `sql` and `bytes` are set only by run_readonly_query, for the transparency panel. */
export type ToolResult = { rows: unknown[]; rowCount: number; note?: string; sql?: string; bytes?: number };

export type AiSummary = { summary: string; likely_cause: Enums["likely_cause"]; evidence: string[]; suggested_reply: string };

/** Dependencies a tool may need. The ticket summariser is injected so this file never imports the model client. */
export type ToolContext = {
  db: ServiceClient;
  now: Date;
  summarizeTicket: (ticketId: string) => Promise<AiSummary>;
};

export type ToolSpec<S extends z.ZodType = z.ZodType> = {
  name: string;
  description: string;
  schema: S;
  run: (input: z.infer<S>, ctx: ToolContext) => Promise<ToolResult>;
};

const kitState = z.enum(KIT_STATES as [KitState, ...KitState[]]);
const plan = z.enum(["standalone", "membership_first", "study"]);
const segment = z.enum(["androgen", "insulin", "cortisol", "nutrient", "inflammation", "mixed"]);
const kitCode = z.string().regex(/^BL-\d{4}-[A-Z]{2}$/i, "Kit codes look like BL-4471-XK");

function tool<S extends z.ZodType>(spec: ToolSpec<S>): ToolSpec<S> {
  return spec;
}

function fail(error: { message: string } | null): void {
  if (error) throw new Error(error.message);
}

/** Customers the model may see: masked email, no consent flags beyond research. */
const CUSTOMER_COLUMNS = "id, first_name, email_masked, plan, membership, region_state, age_band, acquisition_channel, creator_code, created_at";

export const searchCustomers = tool({
  name: "search_customers",
  description: "Fuzzy search customers by first name, masked email, or kit code. Returns up to 20 matches.",
  schema: z.object({ query: z.string().min(1).max(80) }),
  run: async ({ query }, { db }) => {
    const like = `%${query.replace(/[%_]/g, "")}%`;
    const byKit = await db.from("kits").select("customer_id").ilike("kit_code", like).limit(20);
    fail(byKit.error);
    const ids = (byKit.data ?? []).map((k) => k.customer_id);
    let q = db.from("customers").select(CUSTOMER_COLUMNS).limit(20);
    q = ids.length > 0
      ? q.or(`first_name.ilike.${like},email_masked.ilike.${like},id.in.(${ids.join(",")})`)
      : q.or(`first_name.ilike.${like},email_masked.ilike.${like}`);
    const { data, error } = await q;
    fail(error);
    return { rows: data ?? [], rowCount: data?.length ?? 0 };
  },
});

export const getCustomer = tool({
  name: "get_customer",
  description: "One customer's profile, kits, segment and membership by customer id.",
  schema: z.object({ customer_id: z.uuid() }),
  run: async ({ customer_id }, { db, now }) => {
    const [customer, kits, seg] = await Promise.all([
      db.from("customers").select(CUSTOMER_COLUMNS).eq("id", customer_id).maybeSingle(),
      db.from("kits").select("kit_code, sequence_no, state, state_entered_at, created_at").eq("customer_id", customer_id).order("sequence_no"),
      db.from("customer_segments").select("primary_segment, confidence").eq("customer_id", customer_id).maybeSingle(),
    ]);
    fail(customer.error);
    fail(kits.error);
    if (!customer.data) return { rows: [], rowCount: 0, note: "No customer with that id" };
    const sla = await loadSlaHours(db);
    const row = {
      ...customer.data,
      segment: seg.data?.primary_segment ?? null,
      segment_confidence: seg.data?.confidence ?? null,
      kits: (kits.data ?? []).map((k) => ({ ...k, hours_in_state: Math.floor(slaStatus({ id: "", ...k }, now, sla).hoursIn) })),
    };
    return { rows: [row], rowCount: 1 };
  },
});

export const getKitTimeline = tool({
  name: "get_kit_timeline",
  description: "A kit's current state, hours in state, SLA status, every state transition with elapsed time, and the kit's tickets (id, subject, status), by kit code such as BL-4471-XK.",
  schema: z.object({ kit_code: kitCode }),
  run: async ({ kit_code }, { db, now }) => {
    const { data: kit, error } = await db.from("kits").select("id, customer_id, kit_code, sequence_no, state, state_entered_at, created_at").eq("kit_code", kit_code.toUpperCase()).maybeSingle();
    fail(error);
    if (!kit) return { rows: [], rowCount: 0, note: `No kit ${kit_code}` };
    const [events, tickets, sla] = await Promise.all([
      db.from("kit_events").select("from_state, to_state, at, actor, note").eq("kit_id", kit.id).order("at"),
      db.from("tickets").select("id, subject, status, likely_cause, opened_at").eq("kit_id", kit.id).order("opened_at", { ascending: false }),
      loadSlaHours(db),
    ]);
    fail(events.error);
    fail(tickets.error);
    const status = slaStatus(kit, now, sla);
    const timeline = (events.data ?? []).map((e, i, all) => {
      const next = all[i + 1];
      const hours = ((next ? Date.parse(next.at) : now.getTime()) - Date.parse(e.at)) / 3_600_000;
      return { ...e, hours_in_state: Math.round(hours * 10) / 10 };
    });
    const row = {
      kit_code: kit.kit_code,
      customer_id: kit.customer_id,
      sequence_no: kit.sequence_no,
      state: kit.state,
      hours_in_state: Math.floor(status.hoursIn),
      sla_hours: status.slaHours,
      hours_over_sla: Math.floor(status.hoursOver),
      stuck: status.stuck,
      likely_cause: status.cause,
      events: timeline,
      tickets: tickets.data ?? [],
    };
    return { rows: [row], rowCount: 1 + timeline.length + (tickets.data?.length ?? 0) };
  },
});

export const listStuckKits = tool({
  name: "list_stuck_kits",
  description: "Kits past the SLA for their current state, with hours over and the likely cause. Optional filters by state and minimum hours in state. Includes counts by state.",
  schema: z.object({ state: kitState.optional(), older_than_hours: z.number().int().nonnegative().optional() }),
  run: async ({ state, older_than_hours }, { db, now }) => {
    const [kits, sla] = await Promise.all([
      db.from("kits").select("id, kit_code, customer_id, state, state_entered_at"),
      loadSlaHours(db),
    ]);
    fail(kits.error);
    const rows = (kits.data ?? [])
      .filter((k) => isStuck(k, now, sla))
      .filter((k) => (state ? k.state === state : true))
      .map((k) => ({ ...slaRow(k, now, sla), customer_id: k.customer_id }))
      .filter((r) => (older_than_hours !== undefined ? r.hours_in_state >= older_than_hours : true))
      .sort((a, b) => b.hours_over_sla - a.hours_over_sla);
    const byState: Record<string, number> = {};
    for (const r of rows) byState[r.state] = (byState[r.state] ?? 0) + 1;
    return {
      rows: rows.slice(0, ROW_CAP),
      rowCount: rows.length,
      note: `Examined ${kits.data?.length ?? 0} kits. Stuck by state: ${JSON.stringify(byState)}. Retention states (viewed, retest_due) are stuck customers, not ops failures.`,
    };
  },
});

function slaRow(k: { id: string; kit_code: string; state: KitState; state_entered_at: string }, now: Date, sla: SlaHours) {
  const s = slaStatus(k, now, sla);
  return {
    kit_code: k.kit_code,
    state: k.state,
    hours_in_state: Math.floor(s.hoursIn),
    hours_over_sla: Math.floor(s.hoursOver),
    likely_cause: stuckReason(k),
    retention: isRetention(k),
  };
}

const listFilter = z.object({
  state: z.union([kitState, z.array(kitState).min(1)]).optional().describe("Kit state or list of states the customer has a kit in"),
  plan: plan.optional(),
  segment: segment.optional(),
  region_state: z.string().length(2).optional().describe("US state code"),
  days_since_last_login_gte: z.number().int().nonnegative().optional().describe("Customers whose last activity (customer kit event or check-in) is at least this many days ago"),
  retest_due_within_days: z.number().int().nonnegative().optional().describe("Customers whose 90-day retest falls due within this many days and who have not ordered it"),
}).strict();

export const listCustomers = tool({
  name: "list_customers",
  description: "Customers matching a filter on kit state, plan, segment, region, days since last activity, or retest due window. Returns up to 200 rows with current kit state and last activity.",
  schema: z.object({ filter: listFilter }),
  run: async ({ filter }, { db, now }) => {
    const [customers, kits, segments] = await Promise.all([
      db.from("customers").select(CUSTOMER_COLUMNS),
      db.from("kits").select("id, customer_id, kit_code, sequence_no, state, state_entered_at"),
      db.from("customer_segments").select("customer_id, primary_segment"),
    ]);
    fail(customers.error);
    fail(kits.error);
    fail(segments.error);
    const examined = customers.data?.length ?? 0;
    const kitsByCustomer = groupBy(kits.data ?? [], (k) => k.customer_id);
    const segmentOf = new Map((segments.data ?? []).map((s) => [s.customer_id, s.primary_segment]));
    const lastActivity = await lastActivityByCustomer(db, kits.data ?? []);
    const retestDue = filter.retest_due_within_days !== undefined ? await retestDueByCustomer(db, now, filter.retest_due_within_days) : null;
    const states = filter.state === undefined ? null : new Set(Array.isArray(filter.state) ? filter.state : [filter.state]);

    const rows = (customers.data ?? [])
      .filter((c) => (filter.plan ? c.plan === filter.plan : true))
      .filter((c) => (filter.region_state ? c.region_state === filter.region_state.toUpperCase() : true))
      .filter((c) => (filter.segment ? segmentOf.get(c.id) === filter.segment : true))
      .filter((c) => (states ? (kitsByCustomer.get(c.id) ?? []).some((k) => states.has(k.state)) : true))
      .filter((c) => {
        if (filter.days_since_last_login_gte === undefined) return true;
        const last = lastActivity.get(c.id);
        return last === undefined || now.getTime() - last >= filter.days_since_last_login_gte * DAY_MS;
      })
      .filter((c) => (retestDue ? retestDue.has(c.id) : true))
      .map((c) => {
        const latest = (kitsByCustomer.get(c.id) ?? []).sort((a, b) => b.sequence_no - a.sequence_no)[0];
        const last = lastActivity.get(c.id);
        return {
          customer_id: c.id,
          first_name: c.first_name,
          email_masked: c.email_masked,
          plan: c.plan,
          region_state: c.region_state,
          kit_code: latest?.kit_code ?? null,
          kit_state: latest?.state ?? null,
          last_activity_at: last === undefined ? null : new Date(last).toISOString(),
          days_since_activity: last === undefined ? null : Math.floor((now.getTime() - last) / DAY_MS),
        };
      });
    return { rows: rows.slice(0, ROW_CAP), rowCount: rows.length, note: `Examined ${examined} customers; ${rows.length} matched.` };
  },
});

/** Last customer-actor kit event or check-in per customer, in epoch ms. */
async function lastActivityByCustomer(db: ServiceClient, kits: { id: string; customer_id: string }[]): Promise<Map<string, number>> {
  const [events, checkins] = await Promise.all([
    db.from("kit_events").select("kit_id, at").eq("actor", "customer"),
    db.from("checkins").select("customer_id, at"),
  ]);
  fail(events.error);
  fail(checkins.error);
  const customerOfKit = new Map(kits.map((k) => [k.id, k.customer_id]));
  const last = new Map<string, number>();
  const bump = (customerId: string | undefined, at: string) => {
    if (!customerId) return;
    const ms = Date.parse(at);
    if (ms > (last.get(customerId) ?? 0)) last.set(customerId, ms);
  };
  for (const e of events.data ?? []) bump(customerOfKit.get(e.kit_id), e.at);
  for (const c of checkins.data ?? []) bump(c.customer_id, c.at);
  return last;
}

/** Customers whose baseline resulted 90 days ago within the window and who have no retest kit. */
async function retestDueByCustomer(db: ServiceClient, now: Date, withinDays: number): Promise<Set<string>> {
  const [panels, retests] = await Promise.all([
    db.from("panels").select("customer_id, resulted_at").eq("sequence_no", 1),
    db.from("kits").select("customer_id").eq("sequence_no", 2),
  ]);
  fail(panels.error);
  fail(retests.error);
  const hasRetest = new Set((retests.data ?? []).map((k) => k.customer_id));
  const due = new Set<string>();
  for (const p of panels.data ?? []) {
    const dueAt = Date.parse(p.resulted_at) + 90 * DAY_MS;
    if (!hasRetest.has(p.customer_id) && dueAt <= now.getTime() + withinDays * DAY_MS) due.add(p.customer_id);
  }
  return due;
}

export const getTicket = tool({
  name: "get_ticket",
  description: "One support ticket by id, with its customer and kit.",
  schema: z.object({ ticket_id: z.uuid() }),
  run: async ({ ticket_id }, { db }) => {
    const { data, error } = await db
      .from("tickets")
      .select("id, subject, body, status, channel, opened_at, likely_cause, ai_summary, customer:customers(id, first_name, email_masked, plan), kit:kits(kit_code, state, state_entered_at)")
      .eq("id", ticket_id)
      .maybeSingle();
    fail(error);
    if (!data) return { rows: [], rowCount: 0, note: "No ticket with that id" };
    return { rows: [{ ...data, body: data.body.slice(0, 500) }], rowCount: 1 };
  },
});

export const summarizeTicket = tool({
  name: "summarize_ticket",
  description: "AI summary of a ticket by ticket id: summary, likely cause, evidence, suggested reply. Cached on the ticket. Get the id from get_kit_timeline (lists a kit's tickets) or get_ticket.",
  schema: z.object({ ticket_id: z.uuid() }),
  run: async ({ ticket_id }, ctx) => {
    const summary = await ctx.summarizeTicket(ticket_id);
    return { rows: [summary], rowCount: 1 };
  },
});

const METRICS = ["retest_rate", "stuck_count", "open_tickets", "members_active"] as const;
const GROUPS = ["plan", "channel", "segment"] as const;

export const getMetric = tool({
  name: "get_metric",
  description: "One of four headline metrics (retest_rate, stuck_count, open_tickets, members_active), optionally grouped by plan, channel or segment. Not a general counter: for other counts use list_customers or run_readonly_query. retest_rate = customers with a retest panel over customers whose baseline resulted at least 100 days ago.",
  schema: z.object({ name: z.enum(METRICS), group_by: z.enum(GROUPS).optional() }),
  run: async ({ name, group_by }, { db, now }) => {
    const [customers, segments] = await Promise.all([
      db.from("customers").select("id, plan, acquisition_channel, membership"),
      db.from("customer_segments").select("customer_id, primary_segment"),
    ]);
    fail(customers.error);
    fail(segments.error);
    const segmentOf = new Map((segments.data ?? []).map((s) => [s.customer_id, s.primary_segment]));
    const groupOf = (c: { id: string; plan: string; acquisition_channel: string }) =>
      group_by === "plan" ? c.plan : group_by === "channel" ? c.acquisition_channel : group_by === "segment" ? segmentOf.get(c.id) ?? "unknown" : "all";
    const byCustomer = new Map((customers.data ?? []).map((c) => [c.id, c]));

    const tally = new Map<string, { numerator: number; denominator: number }>();
    const add = (customerId: string | null, num: number, den: number) => {
      const c = customerId ? byCustomer.get(customerId) : undefined;
      const key = c ? groupOf(c) : "unknown";
      const t = tally.get(key) ?? { numerator: 0, denominator: 0 };
      t.numerator += num;
      t.denominator += den;
      tally.set(key, t);
    };

    let examined = 0;
    if (name === "retest_rate") {
      const [panels, retests] = await Promise.all([
        db.from("panels").select("customer_id, resulted_at").eq("sequence_no", 1),
        db.from("panels").select("customer_id").eq("sequence_no", 2),
      ]);
      fail(panels.error);
      fail(retests.error);
      const retested = new Set((retests.data ?? []).map((p) => p.customer_id));
      for (const p of panels.data ?? []) {
        examined++;
        if (Date.parse(p.resulted_at) <= now.getTime() - 100 * DAY_MS) add(p.customer_id, retested.has(p.customer_id) ? 1 : 0, 1);
      }
    } else if (name === "stuck_count") {
      const [kits, sla] = await Promise.all([db.from("kits").select("customer_id, state, state_entered_at, id"), loadSlaHours(db)]);
      fail(kits.error);
      for (const k of kits.data ?? []) {
        examined++;
        if (isStuck(k, now, sla) && !isRetention(k)) add(k.customer_id, 1, 0);
      }
    } else if (name === "open_tickets") {
      const tickets = await db.from("tickets").select("customer_id").eq("status", "open");
      fail(tickets.error);
      for (const t of tickets.data ?? []) {
        examined++;
        add(t.customer_id, 1, 0);
      }
    } else {
      for (const c of customers.data ?? []) {
        examined++;
        if (c.membership === "active") add(c.id, 1, 0);
      }
    }

    const rows = [...tally.entries()].map(([group, t]) => ({
      group,
      value: name === "retest_rate" ? (t.denominator === 0 ? null : Math.round((t.numerator / t.denominator) * 1000) / 1000) : t.numerator,
      ...(name === "retest_rate" ? { retested: t.numerator, eligible: t.denominator } : {}),
    }));
    return { rows, rowCount: rows.length, note: `Metric ${name}${group_by ? ` by ${group_by}` : ""}. Examined ${examined} rows.` };
  },
});

/** Columns of the masked views in schema copilot (migration 0005). The model sees this so its SQL names real columns. */
export const COPILOT_SCHEMA = [
  "customers(id, first_name, email_masked, region_state, age_band, sex, acquisition_channel, creator_code, plan, membership, membership_started_at, membership_months, consent_research, created_at)",
  "kits(id, customer_id, kit_code, sequence_no, state, state_entered_at, created_at)",
  "kit_events(id, kit_id, from_state, to_state, at, actor, note)",
  "tickets(id, customer_id, kit_id, channel, subject, body, status, opened_at, likely_cause)",
  "panels(id, kit_id, customer_id, sequence_no, collected_at, resulted_at)",
  "biomarker_results(id, panel_id, marker, value, unit, ref_low, ref_high, flag)",
  "customer_segments(customer_id, primary_segment, confidence, computed_at)",
  "outcomes(customer_id, baseline_panel_id, retest_panel_id, markers_improved, severity_delta, improved, computed_at)",
  "checkins(id, customer_id, at, severity_self_reported)",
  "pending_actions(id, type, customer_id, status, proposed_by, created_at, decided_at)",
  "settings(key, value)",
].join("; ");

export const runReadonlyQuery = tool({
  name: "run_readonly_query",
  description: `Run one SELECT as the restricted copilot role over masked views. Use when the user asks you to run a query or write SQL, or when no typed tool fits. Max 200 rows, 128 KB of results and a 5 second timeout; count or group in SQL rather than selecting whole rows. Refer to views unqualified. Views and columns: ${COPILOT_SCHEMA}. Enum columns hold lowercase values (kit state, plan, primary_segment).`,
  schema: z.object({ sql: z.string().min(1).max(4000) }),
  run: async ({ sql }, { db }) => {
    const guarded = guardSql(sql);
    if (!guarded.ok) throw new Error(`Query rejected by guard: ${guarded.reason}`);
    const explain = await db.rpc("copilot_explain_query", { query: guarded.sql }).abortSignal(AbortSignal.timeout(QUERY_TIMEOUT_MS));
    if (explain.error) throw new Error(`Query rejected by Postgres: ${explain.error.message}`);
    const { data, error } = await db.rpc("copilot_run_readonly_query", { query: guarded.sql }).abortSignal(AbortSignal.timeout(QUERY_TIMEOUT_MS));
    if (error) throw new Error(`Query failed: ${error.message}`);
    const rows = Array.isArray(data) ? (data as unknown[]) : [];
    // The row cap does not bound size: `select jsonb_agg(...) from customers` is one row holding the table.
    // Migration 0009 raises on the same ceiling; this repeats it so the limit holds against an older database.
    const bytes = byteLength(rows);
    if (bytes > RESULT_BYTE_CAP) {
      throw new Error(
        `Result is ${bytes} bytes, over the ${RESULT_BYTE_CAP} byte limit. Aggregate in SQL (count, avg, group by) or select fewer columns instead of returning whole rows.`,
      );
    }
    return { rows, rowCount: rows.length, sql: guarded.sql, bytes, note: rows.length >= ROW_CAP ? `Capped at ${ROW_CAP} rows.` : undefined };
  },
});

function byteLength(rows: unknown[]): number {
  return new TextEncoder().encode(JSON.stringify(rows)).length;
}

export const proposeAction = tool({
  name: "propose_action",
  description: "Record a proposed nudge (sms or email) or ticket note for a human to confirm. Nothing is sent. payload should include a message and, when relevant, kit_code and ticket_id.",
  schema: z.object({
    type: z.enum(["nudge_sms", "nudge_email", "ticket_note"]),
    customer_id: z.uuid(),
    payload: z.record(z.string(), z.unknown()),
  }),
  run: async ({ type, customer_id, payload }, { db }) => {
    const { data, error } = await db
      .from("pending_actions")
      .insert({ type, customer_id, payload: payload as Database["public"]["Tables"]["pending_actions"]["Insert"]["payload"], proposed_by: "copilot", status: "proposed" })
      .select("id, type, customer_id, status, created_at")
      .single();
    fail(error);
    return { rows: [data], rowCount: 1, note: "Proposed only. A staff member must confirm it on /ops." };
  },
});

export const COPILOT_TOOLS: ToolSpec[] = [
  searchCustomers, getCustomer, getKitTimeline, listStuckKits, listCustomers, getTicket, summarizeTicket, getMetric, runReadonlyQuery, proposeAction,
];

/** Vendor-neutral tool definitions. JSON schema is generated from the zod schema, so they cannot drift. */
export function toToolDefinitions(specs: ToolSpec[] = COPILOT_TOOLS): { name: string; description: string; inputSchema: Record<string, unknown> }[] {
  return specs.map((t) => ({ name: t.name, description: t.description, inputSchema: z.toJSONSchema(t.schema) as Record<string, unknown> }));
}

/** The same definitions in the Anthropic SDK's shape. */
export function toAnthropicTools(specs: ToolSpec[] = COPILOT_TOOLS): Anthropic.Tool[] {
  return toToolDefinitions(specs).map((t) => ({ name: t.name, description: t.description, input_schema: t.inputSchema as Anthropic.Tool["input_schema"] }));
}

function groupBy<T>(items: T[], key: (item: T) => string): Map<string, T[]> {
  const out = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    out.set(k, [...(out.get(k) ?? []), item]);
  }
  return out;
}
