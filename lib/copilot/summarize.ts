import { z } from "zod";
import type { ServiceClient } from "../db/service.ts";
import type { Database } from "../db/types.ts";
import type { ModelProvider } from "./provider.ts";
import type { AiSummary } from "./tools.ts";

const LIKELY_CAUSES = ["unlinked_kit", "portal_lockout", "backorder", "shipping_delay", "billing", "registration_mismatch", "refund_request", "clinical_question", "other"] as const;

export const aiSummarySchema = z.object({
  summary: z.string().min(1).max(400),
  likely_cause: z.enum(LIKELY_CAUSES),
  evidence: z.array(z.string()).max(5),
  suggested_reply: z.string().min(1).max(900),
});

const INSTRUCTIONS = `Summarise a support ticket for a BreakoutLabs support agent. Reply with one JSON object and nothing else:
{"summary": "one or two sentences", "likely_cause": one of unlinked_kit|portal_lockout|backorder|shipping_delay|billing|registration_mismatch|refund_request|clinical_question|other, "evidence": ["short quotes or facts from the ticket and kit state, up to 5"], "suggested_reply": "a plain, warm reply under 120 words that states the next step; never promise a refund or a medical opinion"}`;

/** Summary from the cache when present, otherwise from the model, then cached on the ticket. */
export async function summarizeTicket(db: ServiceClient, provider: ModelProvider, ticketId: string): Promise<AiSummary> {
  const { data: ticket, error } = await db
    .from("tickets")
    .select("id, subject, body, status, channel, opened_at, likely_cause, ai_summary, kit:kits(kit_code, state, state_entered_at), customer:customers(first_name, plan)")
    .eq("id", ticketId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!ticket) throw new Error(`No ticket ${ticketId}`);

  const cached = aiSummarySchema.safeParse(ticket.ai_summary);
  if (cached.success) return cached.data;

  const context = {
    subject: ticket.subject,
    body: ticket.body.slice(0, 500),
    channel: ticket.channel,
    opened_at: ticket.opened_at,
    status: ticket.status,
    kit: ticket.kit,
    customer_first_name: ticket.customer?.first_name,
    plan: ticket.customer?.plan,
  };
  const summary = await askModel(provider, JSON.stringify(context));
  const save = await db.from("tickets").update({ ai_summary: summary as Database["public"]["Tables"]["tickets"]["Update"]["ai_summary"] }).eq("id", ticketId);
  if (save.error) throw new Error(save.error.message);
  return summary;
}

async function askModel(provider: ModelProvider, ticketJson: string): Promise<AiSummary> {
  let lastError = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    const user = attempt === 0 ? ticketJson : `${ticketJson}\n\nYour previous reply was not valid: ${lastError}. Reply with the JSON object only.`;
    const text = await provider.complete(INSTRUCTIONS, user);
    const parsed = parseJsonObject(text);
    const valid = aiSummarySchema.safeParse(parsed);
    if (valid.success) return valid.data;
    lastError = valid.error.issues.map((i) => `${i.path.join(".")} ${i.message}`).join("; ") || "not JSON";
  }
  throw new Error(`Ticket summary was not valid JSON after two attempts: ${lastError}`);
}

function parseJsonObject(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}
