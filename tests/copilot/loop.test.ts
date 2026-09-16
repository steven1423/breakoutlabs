import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { describe, expect, it } from "vitest";
import { MAX_TOOL_CALLS, publicRecord, runCopilot, type StreamClient } from "@/lib/copilot/loop";
import type { ToolContext, ToolSpec } from "@/lib/copilot/tools";

type Turn = { text?: string; toolUses?: { name: string; input: unknown }[]; stop?: Anthropic.Message["stop_reason"] };

/** A fake SDK client that plays scripted turns and records what it was sent. */
function fakeClient(turns: Turn[]) {
  const sent: Parameters<StreamClient["messages"]["stream"]>[0][] = [];
  let i = 0;
  const client: StreamClient = {
    messages: {
      stream(params) {
        sent.push(params);
        const turn = turns[Math.min(i, turns.length - 1)];
        i++;
        const listeners: ((d: string) => void)[] = [];
        const content: Anthropic.ContentBlock[] = [];
        if (turn.text) content.push({ type: "text", text: turn.text, citations: null });
        for (const [k, use] of (turn.toolUses ?? []).entries()) content.push({ type: "tool_use", id: `tu-${i}-${k}`, name: use.name, input: use.input } as unknown as Anthropic.ContentBlock);
        const message = {
          id: "msg", type: "message", role: "assistant", model: "fake", content,
          stop_reason: turn.stop ?? (turn.toolUses?.length ? "tool_use" : "end_turn"),
          stop_sequence: null, usage: { input_tokens: 1, output_tokens: 1 },
        } as unknown as Anthropic.Message;
        return {
          on(_event: "text", listener: (d: string) => void) {
            listeners.push(listener);
            if (turn.text) queueMicrotask(() => listener(turn.text!));
            return this;
          },
          finalMessage: () => new Promise<Anthropic.Message>((resolve) => setTimeout(() => resolve(message), 0)),
        };
      },
    },
  };
  return { client, sent };
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
const base = { tools: [echo, boom], ctx, model: "fake", effort: "medium" as const };

describe("runCopilot", () => {
  it("runs tools, appends results, and returns the final answer with one record per call", async () => {
    const { client, sent } = fakeClient([
      { toolUses: [{ name: "echo", input: { n: 1 } }, { name: "echo", input: { n: 2 } }] },
      { text: "Examined 2 rows. Done." },
    ]);
    const events: string[] = [];
    const result = await runCopilot({ ...base, client, question: "go", onEvent: (e) => events.push(e.type) });
    expect(result.answer).toBe("Examined 2 rows. Done.");
    expect(result.stopReason).toBe("end_turn");
    expect(result.calls.map((c) => [c.index, c.name, c.rowCount])).toEqual([[1, "echo", 1], [2, "echo", 1]]);
    expect(events).toEqual(["tool_call", "tool_call", "text", "done"]);
    const second = sent[1].messages;
    expect(second[second.length - 1].role).toBe("user");
    const results = second[second.length - 1].content as Anthropic.ToolResultBlockParam[];
    expect(results.map((r) => r.type)).toEqual(["tool_result", "tool_result"]);
    expect(sent[0].system).toBeDefined();
    expect(sent[0].tools?.map((t) => (t as Anthropic.Tool).name)).toEqual(["echo", "boom"]);
  });

  it("stops after eight tool calls and makes the last turn answer without tools", async () => {
    const { client, sent } = fakeClient([{ toolUses: [{ name: "echo", input: { n: 1 } }] }, { toolUses: [{ name: "echo", input: { n: 1 } }] }]);
    const result = await runCopilot({ ...base, client, question: "loop forever" });
    expect(result.calls.length).toBe(MAX_TOOL_CALLS);
    expect(result.capped).toBe(true);
    expect(sent.length).toBe(MAX_TOOL_CALLS + 1);
    expect((sent[sent.length - 1] as { tool_choice?: { type: string } }).tool_choice).toEqual({ type: "none" });
    expect((sent[0] as { tool_choice?: unknown }).tool_choice).toBeUndefined();
  });

  it("turns a tool error and an invalid input into error results and keeps going", async () => {
    const { client, sent } = fakeClient([
      { toolUses: [{ name: "boom", input: {} }, { name: "echo", input: { n: "not a number" } }, { name: "nope", input: {} }] },
      { text: "Two tools failed." },
    ]);
    const result = await runCopilot({ ...base, client, question: "try" });
    expect(result.calls.map((c) => c.error)).toEqual(["database exploded", expect.stringMatching(/Invalid input/), "Unknown tool nope"]);
    const results = sent[1].messages[sent[1].messages.length - 1].content as Anthropic.ToolResultBlockParam[];
    expect(results.every((r) => r.is_error)).toBe(true);
    expect(result.answer).toBe("Two tools failed.");
  });

  it("ends on refusal and on max_tokens without running tools", async () => {
    const refused = await runCopilot({ ...base, client: fakeClient([{ text: "", stop: "refusal" }]).client, question: "x" });
    expect(refused.stopReason).toBe("refusal");
    expect(refused.calls).toEqual([]);
    expect(refused.answer).toMatch(/declined/);
    const cut = await runCopilot({ ...base, client: fakeClient([{ text: "partial", toolUses: [{ name: "echo", input: { n: 1 } }], stop: "max_tokens" }]).client, question: "x" });
    expect(cut.calls).toEqual([]);
    expect(cut.answer).toMatch(/cut off/);
  });

  it("passes prior turns as history and the effort level in output_config", async () => {
    const { client, sent } = fakeClient([{ text: "ok" }]);
    await runCopilot({ ...base, client, question: "follow-up", history: [{ role: "user", content: "first" }, { role: "assistant", content: "reply" }], effort: "high" });
    expect(sent[0].messages.map((m) => m.role)).toEqual(["user", "assistant", "user"]);
    expect((sent[0] as { output_config?: { effort?: string } }).output_config?.effort).toBe("high");
  });

  it("publicRecord strips rows but keeps the transparency fields", () => {
    const record = publicRecord({ index: 1, name: "run_readonly_query", input: { sql: "select 1" }, rowCount: 1, ms: 3, sql: "select 1", rows: [{ a: 1 }] });
    expect(record).toEqual({ index: 1, name: "run_readonly_query", input: { sql: "select 1" }, rowCount: 1, ms: 3, sql: "select 1" });
  });
});
