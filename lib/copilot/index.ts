import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenAI } from "@google/genai";
import { createServiceSupabase } from "../db/service.ts";
import { copilotEffort, copilotKeyName, copilotModel, copilotProvider, isCopilotConfigured } from "./env.ts";
import { runCopilot, type CopilotEvent, type HistoryTurn, type RunResult } from "./loop.ts";
import type { ModelProvider } from "./provider.ts";
import { AnthropicProvider } from "./providers/anthropic.ts";
import { GeminiProvider } from "./providers/gemini.ts";
import { summarizeTicket } from "./summarize.ts";
import { COPILOT_TOOLS, type ToolContext } from "./tools.ts";

/** Picks the vendor from MODEL_PROVIDER. Both clients read their key from the environment. */
export function createProvider(): ModelProvider {
  if (!isCopilotConfigured()) throw new Error(`Not configured: ${copilotKeyName()}`);
  const model = copilotModel();
  const effort = copilotEffort();
  if (copilotProvider() === "gemini") return new GeminiProvider(new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }), model, effort);
  return new AnthropicProvider(new Anthropic(), model, effort);
}

/** Wires the provider, database and tools together. The route and the eval script both use this. */
export function createCopilot() {
  const provider = createProvider();
  const db = createServiceSupabase();
  const ctx: ToolContext = {
    db,
    now: new Date(),
    summarizeTicket: (ticketId) => summarizeTicket(db, provider, ticketId),
  };
  return {
    provider,
    ask(question: string, history: HistoryTurn[] = [], onEvent?: (e: CopilotEvent) => void): Promise<RunResult> {
      return runCopilot({ question, history, provider, tools: COPILOT_TOOLS, ctx, onEvent });
    },
    summarize(ticketId: string) {
      return ctx.summarizeTicket(ticketId);
    },
  };
}
