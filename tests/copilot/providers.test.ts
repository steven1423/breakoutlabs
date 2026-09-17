import type Anthropic from "@anthropic-ai/sdk";
import type { GenerateContentResponse } from "@google/genai";
import { describe, expect, it } from "vitest";
import { EmptyTurnError, isRetryable, type NeutralMessage } from "@/lib/copilot/provider";
import { AnthropicProvider, toAnthropicMessages, type AnthropicLikeClient } from "@/lib/copilot/providers/anthropic";
import { GeminiProvider, THINKING_BUDGET, toGeminiContents, type GeminiLikeClient } from "@/lib/copilot/providers/gemini";

const history: NeutralMessage[] = [
  { role: "user", text: "where is kit BL-4471-XK" },
  { role: "assistant", text: "", toolCalls: [{ id: "c1", name: "get_kit_timeline", input: { kit_code: "BL-4471-XK" } }] },
  { role: "tool_results", results: [{ callId: "c1", name: "get_kit_timeline", content: '{"rowCount":1}', isError: false }, { callId: "c2", name: "boom", content: "exploded", isError: true }] },
];
const tools = [{ name: "get_kit_timeline", description: "kit", inputSchema: { type: "object", properties: { kit_code: { type: "string" } } } }];

describe("Anthropic provider", () => {
  it("converts neutral history to Messages API shape, replaying raw blocks when present", () => {
    const raw = [{ type: "tool_use", id: "c1", name: "get_kit_timeline", input: {} }];
    const out = toAnthropicMessages([history[0], { ...history[1], raw } as NeutralMessage, history[2]]);
    expect(out[0]).toEqual({ role: "user", content: "where is kit BL-4471-XK" });
    expect(out[1]).toEqual({ role: "assistant", content: raw });
    expect(out[2].role).toBe("user");
    const results = out[2].content as Anthropic.ToolResultBlockParam[];
    expect(results[0]).toEqual({ type: "tool_result", tool_use_id: "c1", content: '{"rowCount":1}' });
    expect(results[1]).toEqual({ type: "tool_result", tool_use_id: "c2", content: "exploded", is_error: true });
  });

  it("streams text, maps tool_use and stop reasons, and sends tool_choice none on the capped turn", async () => {
    const sent: Parameters<AnthropicLikeClient["messages"]["stream"]>[0][] = [];
    const message = {
      content: [{ type: "text", text: "hi" }, { type: "tool_use", id: "c9", name: "get_kit_timeline", input: { kit_code: "BL-1" } }],
      stop_reason: "tool_use",
    } as unknown as Anthropic.Message;
    const client: AnthropicLikeClient = {
      messages: {
        stream: (params) => {
          sent.push(params);
          return { on: (_e, l) => { l("hi"); return undefined; }, finalMessage: async () => message };
        },
        create: async () => ({ content: [{ type: "text", text: '{"a":1}' }] }) as unknown as Anthropic.Message,
      },
    };
    const provider = new AnthropicProvider(client, "claude-sonnet-5", "high");
    const deltas: string[] = [];
    const turn = await provider.streamTurn({ system: "sys", messages: history.slice(0, 1), tools, allowTools: true, onText: (d) => deltas.push(d) });
    expect(deltas).toEqual(["hi"]);
    expect(turn.stopReason).toBe("tool_use");
    expect(turn.toolCalls).toEqual([{ id: "c9", name: "get_kit_timeline", input: { kit_code: "BL-1" } }]);
    expect(turn.assistantMessage).toMatchObject({ role: "assistant", raw: message.content });
    expect((sent[0] as { output_config?: { effort?: string } }).output_config?.effort).toBe("high");
    expect((sent[0] as { tool_choice?: unknown }).tool_choice).toBeUndefined();
    await provider.streamTurn({ system: "sys", messages: history.slice(0, 1), tools, allowTools: false });
    expect((sent[1] as { tool_choice?: { type: string } }).tool_choice).toEqual({ type: "none" });
    expect(await provider.complete("s", "u")).toBe('{"a":1}');
  });
});

describe("Gemini provider", () => {
  it("converts neutral history to contents, keeps thought signatures, and wraps results as functionResponse parts", () => {
    const raw = [{ functionCall: { name: "get_kit_timeline", args: { kit_code: "BL-4471-XK" } }, thoughtSignature: "sig" }];
    const out = toGeminiContents([history[0], { ...history[1], raw } as NeutralMessage, history[2]]);
    expect(out[0]).toEqual({ role: "user", parts: [{ text: "where is kit BL-4471-XK" }] });
    expect(out[1]).toEqual({ role: "model", parts: raw });
    expect(out[2].role).toBe("user");
    expect(out[2].parts?.[0].functionResponse).toEqual({ id: "c1", name: "get_kit_timeline", response: { output: { rowCount: 1 } } });
    expect(out[2].parts?.[1].functionResponse).toEqual({ id: "c2", name: "boom", response: { error: "exploded" } });
  });

  it("streams chunks, skips thoughts, collects function calls with signatures, and omits tools on the capped turn", async () => {
    const sent: Parameters<GeminiLikeClient["models"]["generateContentStream"]>[0][] = [];
    const chunks = [
      { candidates: [{ content: { parts: [{ text: "think", thought: true }, { text: "Loo" }] } }] },
      { candidates: [{ content: { parts: [{ text: "king" }, { functionCall: { name: "get_kit_timeline", args: { kit_code: "BL-1" } }, thoughtSignature: "sig" }] }, finishReason: "STOP" }] },
    ] as unknown as GenerateContentResponse[];
    const client: GeminiLikeClient = {
      models: {
        generateContentStream: async (params) => { sent.push(params); return (async function* () { for (const c of chunks) yield c; })(); },
        generateContent: async () => ({ text: '{"b":2}' }) as unknown as GenerateContentResponse,
      },
    };
    const provider = new GeminiProvider(client, "gemini-2.5-flash", "medium");
    const deltas: string[] = [];
    const turn = await provider.streamTurn({ system: "sys", messages: history.slice(0, 1), tools, allowTools: true, onText: (d) => deltas.push(d) });
    expect(deltas).toEqual(["Loo", "king"]);
    expect(turn.text).toBe("Looking");
    expect(turn.stopReason).toBe("tool_use");
    expect(turn.toolCalls).toEqual([{ id: "call_1", name: "get_kit_timeline", input: { kit_code: "BL-1" }, signature: "sig" }]);
    expect((turn.assistantMessage as { raw: unknown[] }).raw).toHaveLength(3);
    expect(sent[0].config?.tools).toHaveLength(1);
    expect(sent[0].config?.thinkingConfig?.thinkingBudget).toBe(THINKING_BUDGET.medium);
    expect(sent[0].config?.temperature).toBe(0);
    expect(sent[0].config?.systemInstruction).toBe("sys");
    await provider.streamTurn({ system: "sys", messages: history.slice(0, 1), tools, allowTools: false });
    expect(sent[1].config?.tools).toBeUndefined();
    expect(await provider.complete("s", "u")).toBe('{"b":2}');
  });

  it("maps safety finishes and prompt blocks to refusal, MAX_TOKENS to max_tokens, plain STOP to end_turn", async () => {
    const make = (chunk: unknown) => new GeminiProvider({ models: { generateContentStream: async () => (async function* () { yield chunk as GenerateContentResponse; })(), generateContent: async () => ({}) as GenerateContentResponse } }, "m", "low");
    const run = (chunk: unknown) => make(chunk).streamTurn({ system: "s", messages: [{ role: "user", text: "q" }], tools: [], allowTools: true });
    expect((await run({ candidates: [{ content: { parts: [{ text: "no" }] }, finishReason: "SAFETY" }] })).stopReason).toBe("refusal");
    expect((await run({ promptFeedback: { blockReason: "SAFETY" }, candidates: [] })).stopReason).toBe("refusal");
    expect((await run({ candidates: [{ content: { parts: [{ text: "cut" }] }, finishReason: "MAX_TOKENS" }] })).stopReason).toBe("max_tokens");
    expect((await run({ candidates: [{ content: { parts: [{ text: "done" }] }, finishReason: "STOP" }] })).stopReason).toBe("end_turn");
  });

  it("throws a retryable EmptyTurnError when the model returns neither text nor a function call", async () => {
    const provider = new GeminiProvider({ models: { generateContentStream: async () => (async function* () { yield { candidates: [{ content: { parts: [] }, finishReason: "MALFORMED_FUNCTION_CALL" }] } as unknown as GenerateContentResponse; })(), generateContent: async () => ({}) as GenerateContentResponse } }, "m", "low");
    const attempt = provider.streamTurn({ system: "s", messages: [{ role: "user", text: "q" }], tools: [], allowTools: true });
    await expect(attempt).rejects.toBeInstanceOf(EmptyTurnError);
    await attempt.catch((err) => expect(isRetryable(err)).toBe(true));
  });

  it("re-samples a one-shot completion that comes back empty", async () => {
    const replies = ["", "", '{"ok":true}'];
    let calls = 0;
    const provider = new GeminiProvider(
      {
        models: {
          generateContentStream: async () => (async function* () {})() as never,
          generateContent: async () => ({ text: replies[calls++] }) as unknown as GenerateContentResponse,
        },
      },
      "m",
      "low",
    );
    expect(await provider.complete("s", "u")).toBe('{"ok":true}');
    expect(calls).toBe(3);
  });

  it("maps every effort level to a thinking budget", () => {
    expect(THINKING_BUDGET).toEqual({ low: 0, medium: 1024, high: 4096, xhigh: -1, max: -1 });
  });
});
