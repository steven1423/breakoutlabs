import Anthropic from "@anthropic-ai/sdk";
import { createServiceSupabase } from "../db/service.ts";
import { copilotEffort, copilotModel, isCopilotConfigured } from "./env.ts";
import { runCopilot, type CopilotEvent, type RunResult } from "./loop.ts";
import { summarizeTicket } from "./summarize.ts";
import { COPILOT_TOOLS, type ToolContext } from "./tools.ts";
import type { MessageParam } from "@anthropic-ai/sdk/resources/messages";

/** Wires the real client, database and tools together. The route and the eval script both use this. */
export function createCopilot() {
  if (!isCopilotConfigured()) throw new Error("Not configured: ANTHROPIC_API_KEY");
  const client = new Anthropic();
  const db = createServiceSupabase();
  const model = copilotModel();
  const ctx: ToolContext = {
    db,
    now: new Date(),
    summarizeTicket: (ticketId) => summarizeTicket(db, client, model, ticketId),
  };
  return {
    ask(question: string, history: MessageParam[] = [], onEvent?: (e: CopilotEvent) => void): Promise<RunResult> {
      return runCopilot({ question, history, client, tools: COPILOT_TOOLS, ctx, model, effort: copilotEffort(), onEvent });
    },
    summarize(ticketId: string) {
      return ctx.summarizeTicket(ticketId);
    },
  };
}
