import type Anthropic from "@anthropic-ai/sdk";
import { SYSTEM_PROMPT } from "./prompt.ts";
import type { ToolContext, ToolSpec } from "./tools.ts";
import { toAnthropicTools } from "./tools.ts";
import type { Effort } from "./env.ts";

export const MAX_TOOL_CALLS = 8;

/** One row of the transparency panel (CLAUDE.md §7). */
export type ToolCallRecord = {
  index: number;
  name: string;
  input: unknown;
  rowCount: number | null;
  ms: number;
  sql?: string;
  note?: string;
  error?: string;
};

export type CopilotEvent =
  | { type: "text"; delta: string }
  | { type: "tool_call"; call: ToolCallRecord }
  | { type: "done"; answer: string; calls: ToolCallRecord[]; stopReason: string; capped: boolean }
  | { type: "error"; message: string };

type StreamParams = Parameters<Anthropic["messages"]["stream"]>[0];

/** The slice of the SDK client the loop uses. Tests pass a fake with the same shape. */
export type StreamClient = {
  messages: {
    stream: (params: StreamParams) => {
      on: (event: "text", listener: (delta: string) => void) => unknown;
      finalMessage: () => Promise<Anthropic.Message>;
    };
  };
};

export type RunOptions = {
  question: string;
  history?: Anthropic.MessageParam[];
  client: StreamClient;
  tools: ToolSpec[];
  ctx: ToolContext;
  model: string;
  effort: Effort;
  onEvent?: (event: CopilotEvent) => void;
  maxToolCalls?: number;
};

export type RunResult = { answer: string; calls: ToolCallRecord[]; stopReason: string; capped: boolean; messages: Anthropic.MessageParam[] };

/**
 * The standard tool-use loop: send, run every tool_use, append tool_result, repeat until end_turn.
 * Stops after `maxToolCalls` tool calls; the last turn then runs without tools so the model can answer.
 */
export async function runCopilot(opts: RunOptions): Promise<RunResult> {
  const emit = opts.onEvent ?? (() => {});
  const maxCalls = opts.maxToolCalls ?? MAX_TOOL_CALLS;
  const tools = toAnthropicTools(opts.tools);
  const byName = new Map(opts.tools.map((t) => [t.name, t]));
  const messages: Anthropic.MessageParam[] = [...(opts.history ?? []), { role: "user", content: opts.question }];
  const calls: ToolCallRecord[] = [];
  let answer = "";
  let capped = false;

  for (;;) {
    const toolsExhausted = calls.length >= maxCalls;
    const stream = opts.client.messages.stream({
      model: opts.model,
      max_tokens: 8000,
      system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
      tools,
      ...(toolsExhausted ? { tool_choice: { type: "none" } } : {}),
      output_config: { effort: opts.effort },
      messages: [...messages],
    });
    stream.on("text", (delta) => {
      answer += delta;
      emit({ type: "text", delta });
    });
    const message = await stream.finalMessage();
    const toolUses = message.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");

    if (message.stop_reason !== "tool_use" || toolUses.length === 0 || toolsExhausted) {
      const stopReason = message.stop_reason ?? "end_turn";
      if (stopReason === "max_tokens") answer += "\n\nThe answer was cut off at the output limit.";
      if (stopReason === "refusal") answer += "\n\nThe model declined to answer this question.";
      messages.push({ role: "assistant", content: message.content });
      emit({ type: "done", answer, calls, stopReason, capped });
      return { answer, calls, stopReason, capped, messages };
    }

    messages.push({ role: "assistant", content: message.content });
    const results: Anthropic.ToolResultBlockParam[] = [];
    for (const use of toolUses) {
      const record = await executeTool(byName.get(use.name), use, calls.length + 1, opts.ctx);
      calls.push(record);
      emit({ type: "tool_call", call: record });
      results.push(toToolResult(use.id, record));
    }
    messages.push({ role: "user", content: results });
    if (calls.length >= maxCalls) {
      capped = true;
      answer += "";
    }
  }
}

async function executeTool(spec: ToolSpec | undefined, use: Anthropic.ToolUseBlock, index: number, ctx: ToolContext): Promise<ToolCallRecord> {
  const started = Date.now();
  const base = { index, name: use.name, input: use.input };
  if (!spec) return { ...base, rowCount: null, ms: 0, error: `Unknown tool ${use.name}` };
  const parsed = spec.schema.safeParse(use.input);
  if (!parsed.success) return { ...base, rowCount: null, ms: 0, error: `Invalid input: ${parsed.error.issues.map((i) => `${i.path.join(".")} ${i.message}`).join("; ")}` };
  try {
    const result = await spec.run(parsed.data, ctx);
    return { ...base, rowCount: result.rowCount, ms: Date.now() - started, sql: result.sql, note: result.note, rows: result.rows } as ToolCallRecord & { rows: unknown[] };
  } catch (err) {
    return { ...base, rowCount: null, ms: Date.now() - started, error: err instanceof Error ? err.message : String(err) };
  }
}

function toToolResult(toolUseId: string, record: ToolCallRecord & { rows?: unknown[] }): Anthropic.ToolResultBlockParam {
  if (record.error) return { type: "tool_result", tool_use_id: toolUseId, is_error: true, content: record.error };
  const body = { rowCount: record.rowCount, note: record.note, rows: record.rows ?? [] };
  return { type: "tool_result", tool_use_id: toolUseId, content: JSON.stringify(body) };
}

/** Strips the row payload so the transparency panel and the transcript carry only what the UI shows. */
export function publicRecord(record: ToolCallRecord & { rows?: unknown[] }): ToolCallRecord {
  const { rows: _rows, ...rest } = record;
  void _rows;
  return rest;
}
