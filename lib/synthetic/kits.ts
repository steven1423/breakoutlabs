import type { Database } from "../db/types.ts";
import {
  CHECKIN_DAYS_BEFORE_RETEST_DUE, DAY_MS, DEMO_KIT_CODE, DWELL_HOURS, HOUR_MS, RETEST_DAY_RANGE, TODAY_MS,
  type KitState,
} from "./constants.ts";
import type { Person } from "./customers.ts";
import type { Rng } from "./rng.ts";

type Actor = Database["public"]["Enums"]["actor"];
export type KitInsert = Database["public"]["Tables"]["kits"]["Insert"] & {
  id: string;
  sequence_no: number;
  state_entered_at: string;
  created_at: string;
};
export type KitEventInsert = Database["public"]["Tables"]["kit_events"]["Insert"] & { id: string; at: string };

/** One kit with its event chain and the timestamps other generators need. */
export type KitBundle = {
  kit: KitInsert;
  events: KitEventInsert[];
  person: Person;
  enteredMs: Partial<Record<KitState, number>>;
};

const HAPPY_PATH: readonly KitState[] = [
  "ordered", "shipped", "delivered", "registered", "sample_received", "resulted",
  "blueprint_ready", "viewed", "checkin_active", "retest_due",
];

const ACTOR_FOR: Partial<Record<KitState, Actor>> = {
  ordered: "customer", shipped: "system", delivered: "system", registered: "customer",
  sample_received: "lab", resulted: "lab", blueprint_ready: "system", viewed: "customer",
  checkin_active: "system", retest_due: "system", retest_ordered: "customer",
};

export function generateKits(rng: Rng, people: Person[]): KitBundle[] {
  const codes = new Set<string>([DEMO_KIT_CODE]);
  const bundles: KitBundle[] = [];
  for (const [index, person] of people.entries()) {
    if (index === 0) {
      bundles.push(demoKit(rng, person));
      continue;
    }
    const createdMs = Date.parse(person.customer.created_at);
    const retestDay = person.retested ? rng.int(RETEST_DAY_RANGE[0], RETEST_DAY_RANGE[1]) : null;
    const baseline = simulateKit(rng, person, 1, createdMs, retestDay, nextCode(rng, codes));
    bundles.push(baseline);
    const retestOrderedMs = baseline.enteredMs.retest_ordered;
    if (retestOrderedMs !== undefined) {
      bundles.push(simulateKit(rng, person, 2, retestOrderedMs, null, nextCode(rng, codes)));
    }
  }
  injectExceptions(rng, bundles);
  return bundles;
}

/** Walks the happy path from `createdMs` until the clock runs out at TODAY. */
function simulateKit(rng: Rng, person: Person, sequenceNo: number, createdMs: number, retestDay: number | null, code: string): KitBundle {
  const kitId = rng.uuid();
  const events: KitEventInsert[] = [event(rng, kitId, null, "ordered", createdMs)];
  const enteredMs: Partial<Record<KitState, number>> = { ordered: createdMs };
  let t = createdMs;
  let state: KitState = "ordered";

  for (let i = 0; i < HAPPY_PATH.length - 1; i++) {
    state = HAPPY_PATH[i];
    const dwell = dwellMs(rng, state, t, enteredMs.resulted);
    if (dwell === null || t + dwell > TODAY_MS) break;
    t += dwell;
    state = HAPPY_PATH[i + 1];
    events.push(event(rng, kitId, HAPPY_PATH[i], state, t));
    enteredMs[state] = t;
  }

  if (state === "retest_due" && retestDay !== null && enteredMs.resulted !== undefined) {
    const orderedMs = enteredMs.resulted + retestDay * DAY_MS;
    if (orderedMs <= TODAY_MS) {
      events.push(event(rng, kitId, "retest_due", "retest_ordered", orderedMs));
      enteredMs.retest_ordered = orderedMs;
      state = "retest_ordered";
      t = orderedMs;
    }
  }

  return {
    kit: kitRow(kitId, person, sequenceNo, code, state, t, createdMs),
    events,
    person,
    enteredMs,
  };
}

/** Hours a kit sits in a state before moving on. Null means the state has no scheduled exit. */
function dwellMs(rng: Rng, state: KitState, nowMs: number, resultedMs: number | undefined): number | null {
  if (state === "checkin_active" && resultedMs !== undefined) {
    return Math.max(24 * HOUR_MS, resultedMs + CHECKIN_DAYS_BEFORE_RETEST_DUE * DAY_MS - nowMs);
  }
  const range = DWELL_HOURS[state];
  if (!range) return null;
  return rng.int(range[0], range[1]) * HOUR_MS;
}

/**
 * The ~8% of kits stuck right now (§12): results_locked 3%, backordered 2%,
 * registration_mismatch 1%, shipped past SLA 2%. Each rewrite truncates the event chain
 * at the exception point so kit state and events always agree.
 */
function injectExceptions(rng: Rng, bundles: KitBundle[]): void {
  const baseline = bundles.filter((b) => b.kit.sequence_no === 1 && b.kit.kit_code !== DEMO_KIT_CODE);
  const total = baseline.length;
  const taken = new Set<KitBundle>();

  const pickFrom = (candidates: KitBundle[], share: number) => {
    const free = rng.shuffle(candidates.filter((b) => !taken.has(b))).slice(0, Math.round(total * share));
    free.forEach((b) => taken.add(b));
    return free;
  };

  for (const b of pickFrom(baseline.filter((b) => within(b.enteredMs.resulted, 45 * DAY_MS, 36 * HOUR_MS)), 0.03)) {
    const at = b.enteredMs.resulted! + rng.int(1, 6) * HOUR_MS;
    rewrite(rng, b, "resulted", "results_locked", at, "system", "Portal reports kit ID invalid for this account");
  }
  for (const b of pickFrom(baseline.filter((b) => within(b.enteredMs.ordered, 20 * DAY_MS, 4 * DAY_MS)), 0.02)) {
    const at = b.enteredMs.ordered! + rng.int(6, 24) * HOUR_MS;
    rewrite(rng, b, "ordered", "backordered", at, "system", "Collection cards out of stock");
  }
  for (const b of pickFrom(baseline.filter((b) => within(b.enteredMs.registered, 15 * DAY_MS, 30 * HOUR_MS)), 0.01)) {
    const at = b.enteredMs.registered! + rng.int(2, 12) * HOUR_MS;
    rewrite(rng, b, "registered", "registration_mismatch", at, "system", "Birthdate on registration does not match the order");
  }
  for (const b of pickFrom(baseline.filter((b) => within(b.enteredMs.shipped, 20 * DAY_MS, 8 * DAY_MS)), 0.02)) {
    truncateAt(b, "shipped");
  }
}

function within(ms: number | undefined, oldest: number, newest: number): boolean {
  return ms !== undefined && ms >= TODAY_MS - oldest && ms <= TODAY_MS - newest;
}

/** Cuts the chain after `from`, then appends one exception transition. */
function rewrite(rng: Rng, b: KitBundle, from: KitState, to: KitState, atMs: number, actor: Actor, note: string): void {
  truncateAt(b, from);
  b.events.push({ ...event(rng, b.kit.id, from, to, atMs), actor, note });
  b.enteredMs[to] = atMs;
  b.kit.state = to;
  b.kit.state_entered_at = iso(atMs);
}

function truncateAt(b: KitBundle, state: KitState): void {
  const index = b.events.findIndex((e) => e.to_state === state);
  b.events = b.events.slice(0, index + 1);
  for (const key of Object.keys(b.enteredMs) as KitState[]) {
    if (HAPPY_PATH.indexOf(key) > HAPPY_PATH.indexOf(state) || key === "retest_ordered") delete b.enteredMs[key];
  }
  b.kit.state = state;
  b.kit.state_entered_at = iso(b.enteredMs[state]!);
}

/** BL-4471-XK: resulted five days ago, locked out of the portal four days ago (§17). */
function demoKit(rng: Rng, person: Person): KitBundle {
  const kitId = rng.uuid();
  const h = (hoursAgo: number) => TODAY_MS - hoursAgo * HOUR_MS;
  const steps: readonly [KitState, number][] = [
    ["ordered", 384], ["shipped", 366], ["delivered", 294], ["registered", 264],
    ["sample_received", 168], ["resulted", 120], ["results_locked", 96],
  ];
  const events: KitEventInsert[] = [];
  const enteredMs: Partial<Record<KitState, number>> = {};
  let prev: KitState | null = null;
  for (const [state, hoursAgo] of steps) {
    events.push(event(rng, kitId, prev, state, h(hoursAgo)));
    enteredMs[state] = h(hoursAgo);
    prev = state;
  }
  events[events.length - 1].note = "Portal reports kit ID invalid for this account";
  return {
    kit: kitRow(kitId, person, 1, DEMO_KIT_CODE, "results_locked", h(96), h(384)),
    events,
    person,
    enteredMs,
  };
}

function kitRow(id: string, person: Person, sequenceNo: number, code: string, state: KitState, enteredMs: number, createdMs: number): KitInsert {
  return {
    id,
    customer_id: person.customer.id,
    kit_code: code,
    sequence_no: sequenceNo,
    state,
    state_entered_at: iso(enteredMs),
    created_at: iso(createdMs),
  };
}

function event(rng: Rng, kitId: string, from: KitState | null, to: KitState, atMs: number): KitEventInsert {
  return { id: rng.uuid(), kit_id: kitId, from_state: from, to_state: to, at: iso(atMs), actor: ACTOR_FOR[to] ?? "system", note: null };
}

function nextCode(rng: Rng, used: Set<string>): string {
  for (;;) {
    const letters = String.fromCharCode(65 + rng.int(0, 25)) + String.fromCharCode(65 + rng.int(0, 25));
    const code = `BL-${rng.int(1000, 9999)}-${letters}`;
    if (!used.has(code)) {
      used.add(code);
      return code;
    }
  }
}

export function iso(ms: number): string {
  return new Date(ms).toISOString();
}
