import { SYSTEM_PROMPT } from "./prompt.ts";
import { withRetries, type ModelProvider, type NeutralMessage, type ToolCall, type ToolResultMessage } from "./provider.ts";
import type { ToolContext, ToolSpec } from "./tools.ts";
import { toToolDefinitions } from "./tools.ts";

export const MAX_TOOL_CALLS = 8;

/** One row of the transparency panel (CLAUDE.md §7). */
export type ToolCallRecord = {
  index: number;
  name: string;
  input: unknown;
  rowCount: number | null;
  ms: number;
  sql?: string;
  bytes?: number;
  note?: string;
  error?: string;
};

export type CopilotEvent =
  | { type: "text"; delta: string }
  | { type: "tool_call"; call: ToolCallRecord }
  | { type: "done"; answer: string; calls: ToolCallRecord[]; stopReason: string; capped: boolean }
  | { type: "error"; message: string };

/** Prior turns as the UI keeps them. */
export type HistoryTurn = { role: "user" | "assistant"; content: string };

export type RunOptions = {
  question: string;
  history?: HistoryTurn[];
  provider: ModelProvider;
  tools: ToolSpec[];
  ctx: ToolContext;
  onEvent?: (event: CopilotEvent) => void;
  maxToolCalls?: number;
};

export type RunResult = { answer: string; calls: ToolCallRecord[]; stopReason: string; capped: boolean; messages: NeutralMessage[] };

/**
 * The standard tool-use loop: send, run every tool call, append the results, repeat until the model stops.
 * Stops after `maxToolCalls` tool calls; the last turn then runs without tools so the model still answers.
 */
export async function runCopilot(opts: RunOptions): Promise<RunResult> {
  const emit = opts.onEvent ?? (() => {});
  const maxCalls = opts.maxToolCalls ?? MAX_TOOL_CALLS;
  const tools = toToolDefinitions(opts.tools);
  const byName = new Map(opts.tools.map((t) => [t.name, t]));
  const messages: NeutralMessage[] = [...toNeutral(opts.history ?? []), { role: "user", text: opts.question }];
  const calls: ToolCallRecord[] = [];
  let answer = "";
  let capped = false;

  for (;;) {
    const allowTools = calls.length < maxCalls;
    const turn = await withRetries(() =>
      opts.provider.streamTurn({
        system: SYSTEM_PROMPT,
        messages: [...messages],
        tools,
        allowTools,
        onText: (delta) => {
          answer += delta;
          emit({ type: "text", delta });
        },
      }),
    );
    messages.push(turn.assistantMessage);

    if (turn.stopReason !== "tool_use" || turn.toolCalls.length === 0 || !allowTools) {
      if (turn.stopReason === "max_tokens") answer += "\n\nThe answer was cut off at the output limit.";
      if (turn.stopReason === "refusal") answer += "\n\nThe model declined to answer this question.";
      emit({ type: "done", answer, calls, stopReason: turn.stopReason, capped });
      return { answer, calls, stopReason: turn.stopReason, capped, messages };
    }

    const results: ToolResultMessage[] = [];
    for (const call of turn.toolCalls) {
      const record = await executeTool(byName.get(call.name), call, calls.length + 1, opts.ctx);
      calls.push(record);
      emit({ type: "tool_call", call: record });
      results.push(toResult(call, record));
    }
    messages.push({ role: "tool_results", results });
    if (calls.length >= maxCalls) capped = true;
  }
}

function toNeutral(history: HistoryTurn[]): NeutralMessage[] {
  return history.map((h) => (h.role === "user" ? { role: "user", text: h.content } : { role: "assistant", text: h.content, toolCalls: [] }));
}

type RecordWithRows = ToolCallRecord & { rows?: unknown[] };

async function executeTool(spec: ToolSpec | undefined, call: ToolCall, index: number, ctx: ToolContext): Promise<RecordWithRows> {
  const started = Date.now();
  const base = { index, name: call.name, input: call.input };
  if (!spec) return { ...base, rowCount: null, ms: 0, error: `Unknown tool ${call.name}` };
  const parsed = spec.schema.safeParse(call.input);
  if (!parsed.success) return { ...base, rowCount: null, ms: 0, error: `Invalid input: ${parsed.error.issues.map((i) => `${i.path.join(".")} ${i.message}`).join("; ")}` };
  try {
    const result = await spec.run(parsed.data, ctx);
    return { ...base, rowCount: result.rowCount, ms: Date.now() - started, sql: result.sql, bytes: result.bytes, note: result.note, rows: result.rows };
  } catch (err) {
    return { ...base, rowCount: null, ms: Date.now() - started, error: err instanceof Error ? err.message : String(err) };
  }
}

function toResult(call: ToolCall, record: RecordWithRows): ToolResultMessage {
  if (record.error) return { callId: call.id, name: call.name, content: record.error, isError: true };
  return { callId: call.id, name: call.name, content: JSON.stringify({ rowCount: record.rowCount, note: record.note, rows: record.rows ?? [] }), isError: false };
}

/** Strips the row payload so the transparency panel and the transcript carry only what the UI shows. */
export function publicRecord(record: RecordWithRows): ToolCallRecord {
  const { rows: _rows, ...rest } = record;
  void _rows;
  return rest;
}
