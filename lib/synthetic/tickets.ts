import type { Database } from "../db/types.ts";
import { DEMO_KIT_CODE, HOUR_MS, TODAY_MS } from "./constants.ts";
import { iso, type KitBundle } from "./kits.ts";
import type { Rng } from "./rng.ts";

export type TicketInsert = Database["public"]["Tables"]["tickets"]["Insert"] & { id: string };

type Template = { subject: string; body: (code: string, name: string) => string };

/** Original paraphrases of the complaint patterns in CLAUDE.md §12. No real review text. */
const LOCKED: Template[] = [
  { subject: "Results are ready but I can't open them", body: (c) => `I got the email saying my results are in, but when I log in the portal says kit ${c} is not linked to my account. I've tried three browsers. Please help, it has been days.` },
  { subject: "Secure link keeps sending me to sign in", body: (c) => `Every time I click the results link it bounces me to the sign-in page and then back to a blank dashboard. My kit is ${c}. I paid for this test and can't see anything.` },
  { subject: "Kit ID invalid", body: (c) => `The portal says "kit ID invalid" for ${c} even though the lab confirmed they received my sample two weeks ago. Is there someone who can attach it manually?` },
];
const BACKORDER: Template[] = [
  { subject: "Ordered weeks ago, no shipping notice", body: (c) => `I ordered on the 1st and still have no tracking number for ${c}. The confirmation said 2–3 days. Is it coming or should I cancel?` },
  { subject: "Where is my kit?", body: (c) => `No update since my order confirmation for kit ${c}. Support chat says nobody is available. Can someone tell me what is going on?` },
];
const SHIPPING: Template[] = [
  { subject: "Tracking has not moved in ten days", body: (c) => `The label for ${c} was created but USPS shows it never left your facility. Did it actually ship?` },
  { subject: "Kit stuck in transit", body: (c) => `My kit ${c} has said "in transit" for over a week. I'm travelling next month and need to collect before then.` },
];
const MISMATCH: Template[] = [
  { subject: "Registration rejected, birthday", body: (c) => `I'm registering kit ${c} for my daughter (she's 17) and the form keeps rejecting her birthday even though I entered it exactly as on the order.` },
  { subject: "Can't register kit, name mismatch", body: (c) => `The registration for ${c} says the name doesn't match the order. I used my married name on the order and my maiden name on the account. How do I fix this?` },
];
const REFUND: Template[] = [
  { subject: "Refund under the 90-day guarantee", body: (_, n) => `Hi, this is ${n}. I followed the blueprint for three months and my skin is about the same. I'd like to use the 90-day guarantee and get a refund.` },
  { subject: "Cancel membership and refund", body: () => `Please cancel my membership and refund the last charge. I didn't realise it renewed monthly.` },
];
const CLINICAL: Template[] = [
  { subject: "Question about my cortisol result", body: () => `My cortisol came back high but I collected the sample right after a stressful morning. Does that change the reading? Should I retest?` },
  { subject: "What does low SHBG mean?", body: () => `My results flagged SHBG as low. The blueprint mentions it but I don't understand what I should actually do differently.` },
  { subject: "Insulin flagged but I'm not diabetic", body: () => `My fasting insulin was flagged high. I have normal blood sugar according to my doctor. Is this something to worry about?` },
];
const BILLING: Template[] = [
  { subject: "Charged twice", body: () => `I see two charges on my card for the same order. Can you refund one of them?` },
  { subject: "Promo code didn't apply", body: () => `I entered a creator code at checkout but the discount doesn't show on my receipt.` },
];
const RESOLVED: Template[] = [
  { subject: "Couldn't see results (fixed)", body: (c) => `Following up: after your team relinked kit ${c} I can see everything now. Thank you.` },
];

const CHANNELS: readonly (readonly [string, number])[] = [["email", 70], ["sms", 20], ["phone", 10]];

/** About 60 tickets: some tied to stuck kits (unclassified, for the sweep and copilot), the rest general. */
export function generateTickets(rng: Rng, bundles: KitBundle[]): TicketInsert[] {
  const tickets: TicketInsert[] = [];
  const stuck = (state: string) => bundles.filter((b) => b.kit.state === state && b.kit.kit_code !== DEMO_KIT_CODE);

  const demo = bundles.find((b) => b.kit.kit_code === DEMO_KIT_CODE)!;
  tickets.push(ticket(rng, demo, LOCKED[2], demo.enteredMs.results_locked! + 20 * HOUR_MS, "open"));

  const tied: [KitBundle[], Template[], number][] = [
    [stuck("results_locked"), LOCKED, 10],
    [stuck("backordered"), BACKORDER, 6],
    [stuck("shipped"), SHIPPING, 5],
    [stuck("registration_mismatch"), MISMATCH, 3],
  ];
  for (const [kits, templates, count] of tied) {
    for (const b of rng.shuffle(kits).slice(0, count)) {
      const openedMs = Math.min(TODAY_MS - HOUR_MS, Date.parse(b.kit.state_entered_at) + rng.int(12, 72) * HOUR_MS);
      tickets.push(ticket(rng, b, rng.pick(templates), openedMs, "open"));
    }
  }

  const settled = bundles.filter((b) => b.enteredMs.viewed !== undefined && b.kit.sequence_no === 1);
  const general: [Template[], number, "open" | "pending_customer" | "resolved"][] = [
    [REFUND, 8, "open"], [CLINICAL, 10, "open"], [BILLING, 5, "pending_customer"], [RESOLVED, 6, "resolved"], [MISMATCH, 4, "resolved"], [SHIPPING, 4, "resolved"],
  ];
  for (const [templates, count, status] of general) {
    for (const b of rng.shuffle(settled).slice(0, count)) {
      const openedMs = TODAY_MS - rng.int(2, 60) * 24 * HOUR_MS;
      tickets.push(ticket(rng, b, rng.pick(templates), openedMs, status));
    }
  }
  return tickets;
}

function ticket(rng: Rng, b: KitBundle, t: Template, openedMs: number, status: TicketInsert["status"]): TicketInsert {
  return {
    id: rng.uuid(),
    customer_id: b.kit.customer_id,
    kit_id: b.kit.id,
    channel: rng.weighted(CHANNELS),
    subject: t.subject,
    body: t.body(b.kit.kit_code, b.person.customer.first_name),
    status,
    opened_at: iso(openedMs),
    likely_cause: null,
    ai_summary: null,
  };
}
