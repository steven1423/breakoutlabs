import { z } from "zod";
import { describe, expect, it } from "vitest";
import { MAX_TOOL_CALLS, publicRecord, runCopilot } from "@/lib/copilot/loop";
import { EmptyTurnError, type ModelProvider, type StopReason, type ToolCall, type TurnParams } from "@/lib/copilot/provider";
import type { ToolContext, ToolSpec } from "@/lib/copilot/tools";

type Turn = { text?: string; toolCalls?: { name: string; input: unknown }[]; stop?: StopReason; throwStatus?: number; throwEmpty?: boolean };

/** A fake provider that plays scripted turns and records what it was sent. */
function fakeProvider(turns: Turn[]): { provider: ModelProvider; sent: TurnParams[] } {
  const sent: TurnParams[] = [];
  let i = 0;
  const provider: ModelProvider = {
    name: "anthropic",
    model: "fake",
    async streamTurn(params) {
      sent.push(params);
      const turn = turns[Math.min(i, turns.length - 1)];
      i++;
      if (turn.throwStatus) throw Object.assign(new Error("rate limited"), { status: turn.throwStatus });
      if (turn.throwEmpty) throw new EmptyTurnError("MALFORMED_FUNCTION_CALL");
      if (turn.text) params.onText?.(turn.text);
      const toolCalls: ToolCall[] = (turn.toolCalls ?? []).map((c, k) => ({ id: `tu-${i}-${k}`, name: c.name, input: c.input }));
      const stopReason: StopReason = turn.stop ?? (toolCalls.length ? "tool_use" : "end_turn");
      return { text: turn.text ?? "", toolCalls, stopReason, assistantMessage: { role: "assistant", text: turn.text ?? "", toolCalls } };
    },
    async complete() {
      return "{}";
    },
  };
  return { provider, sent };
}

const echo = {
  name: "echo",
  description: "returns its input",
  schema: z.object({ n: z.number() }),
  run: async ({ n }: { n: number }) => ({ rows: [{ n }], rowCount: 1 }),
} as ToolSpec;
const boom: ToolSpec = {
  name: "boom",
  description: "always fails",
  schema: z.object({}),
  run: async () => { throw new Error("database exploded"); },
};
const ctx = { db: {} as ToolContext["db"], now: new Date("2026-09-16T12:00:00Z"), summarizeTicket: async () => { throw new Error("unused"); } } satisfies ToolContext;
const base = { tools: [echo, boom], ctx };

describe("runCopilot", () => {
  it("runs tools, appends results, and returns the final answer with one record per call", async () => {
    const { provider, sent } = fakeProvider([
      { toolCalls: [{ name: "echo", input: { n: 1 } }, { name: "echo", input: { n: 2 } }] },
      { text: "Examined 2 rows. Done." },
    ]);
    const events: string[] = [];
    const result = await runCopilot({ ...base, provider, question: "go", onEvent: (e) => events.push(e.type) });
    expect(result.answer).toBe("Examined 2 rows. Done.");
    expect(result.stopReason).toBe("end_turn");
    expect(result.calls.map((c) => [c.index, c.name, c.rowCount])).toEqual([[1, "echo", 1], [2, "echo", 1]]);
    expect(events).toEqual(["tool_call", "tool_call", "text", "done"]);
    const second = sent[1].messages;
    expect(second[second.length - 1].role).toBe("tool_results");
    expect(sent[0].messages).toEqual([{ role: "user", text: "go" }]);
    expect(sent[0].system.length).toBeGreaterThan(100);
    expect(sent[0].tools.map((t) => t.name)).toEqual(["echo", "boom"]);
    expect(sent[0].allowTools).toBe(true);
  });

  it("stops after eight tool calls and makes the last turn answer without tools", async () => {
    const { provider, sent } = fakeProvider([{ toolCalls: [{ name: "echo", input: { n: 1 } }] }]);
    const result = await runCopilot({ ...base, provider, question: "loop forever" });
    expect(result.calls.length).toBe(MAX_TOOL_CALLS);
    expect(result.capped).toBe(true);
    expect(sent.length).toBe(MAX_TOOL_CALLS + 1);
    expect(sent[sent.length - 1].allowTools).toBe(false);
    expect(sent[0].allowTools).toBe(true);
  });

  it("turns a tool error and an invalid input into error results and keeps going", async () => {
    const { provider, sent } = fakeProvider([
      { toolCalls: [{ name: "boom", input: {} }, { name: "echo", input: { n: "not a number" } }, { name: "nope", input: {} }] },
      { text: "Two tools failed." },
    ]);
    const result = await runCopilot({ ...base, provider, question: "try" });
    expect(result.calls.map((c) => c.error)).toEqual(["database exploded", expect.stringMatching(/Invalid input/), "Unknown tool nope"]);
    const last = sent[1].messages[sent[1].messages.length - 1];
    expect(last.role === "tool_results" && last.results.every((r) => r.isError)).toBe(true);
    expect(result.answer).toBe("Two tools failed.");
  });

  it("ends on refusal and on max_tokens without running tools", async () => {
    const refused = await runCopilot({ ...base, provider: fakeProvider([{ text: "", stop: "refusal" }]).provider, question: "x" });
    expect(refused.stopReason).toBe("refusal");
    expect(refused.calls).toEqual([]);
    expect(refused.answer).toMatch(/declined/);
    const cut = await runCopilot({ ...base, provider: fakeProvider([{ text: "partial", toolCalls: [{ name: "echo", input: { n: 1 } }], stop: "max_tokens" }]).provider, question: "x" });
    expect(cut.calls).toEqual([]);
    expect(cut.answer).toMatch(/cut off/);
  });

  it("passes prior turns as neutral history", async () => {
    const { provider, sent } = fakeProvider([{ text: "ok" }]);
    await runCopilot({ ...base, provider, question: "follow-up", history: [{ role: "user", content: "first" }, { role: "assistant", content: "reply" }] });
    expect(sent[0].messages.map((m) => m.role)).toEqual(["user", "assistant", "user"]);
  });

  it("retries a rate-limited turn and then succeeds", async () => {
    const { provider, sent } = fakeProvider([{ throwStatus: 429 }, { text: "after retry" }]);
    const result = await runCopilot({ ...base, provider, question: "x" });
    expect(result.answer).toBe("after retry");
    expect(sent.length).toBe(2);
  }, 10_000);

  it("re-samples an empty turn and then succeeds", async () => {
    const { provider, sent } = fakeProvider([{ throwEmpty: true }, { text: "after resample" }]);
    const result = await runCopilot({ ...base, provider, question: "x" });
    expect(result.answer).toBe("after resample");
    expect(sent.length).toBe(2);
  }, 10_000);

  it("publicRecord strips rows but keeps the transparency fields", () => {
    const record = publicRecord({ index: 1, name: "run_readonly_query", input: { sql: "select 1" }, rowCount: 1, ms: 3, sql: "select 1", rows: [{ a: 1 }] });
    expect(record).toEqual({ index: 1, name: "run_readonly_query", input: { sql: "select 1" }, rowCount: 1, ms: 3, sql: "select 1" });
  });
});
