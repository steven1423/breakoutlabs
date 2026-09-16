import type Anthropic from "@anthropic-ai/sdk";
import type { Effort } from "../env.ts";
import type { ModelProvider, NeutralMessage, StopReason, ToolCall, TurnParams, TurnResult } from "../provider.ts";

type StreamParams = Parameters<Anthropic["messages"]["stream"]>[0];

/** The slice of the SDK client this provider uses. Tests pass a fake with the same shape. */
export type AnthropicLikeClient = {
  messages: {
    stream: (params: StreamParams) => {
      on: (event: "text", listener: (delta: string) => void) => unknown;
      finalMessage: () => Promise<Anthropic.Message>;
    };
    create: (params: Anthropic.MessageCreateParamsNonStreaming) => Promise<Anthropic.Message>;
  };
};

export class AnthropicProvider implements ModelProvider {
  readonly name = "anthropic" as const;

  readonly model: string;
  private readonly client: AnthropicLikeClient;
  private readonly effort: Effort;

  constructor(client: AnthropicLikeClient, model: string, effort: Effort) {
    this.client = client;
    this.model = model;
    this.effort = effort;
  }

  async streamTurn(params: TurnParams): Promise<TurnResult> {
    const stream = this.client.messages.stream({
      model: this.model,
      max_tokens: 8000,
      system: [{ type: "text", text: params.system, cache_control: { type: "ephemeral" } }],
      tools: params.tools.map((t) => ({ name: t.name, description: t.description, input_schema: t.inputSchema as Anthropic.Tool["input_schema"] })),
      ...(params.allowTools ? {} : { tool_choice: { type: "none" } }),
      output_config: { effort: this.effort },
      messages: toAnthropicMessages(params.messages),
    });
    let text = "";
    stream.on("text", (delta) => {
      text += delta;
      params.onText?.(delta);
    });
    const message = await stream.finalMessage();
    const toolCalls: ToolCall[] = message.content
      .filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use")
      .map((b) => ({ id: b.id, name: b.name, input: b.input }));
    return {
      text,
      toolCalls,
      stopReason: mapStop(message.stop_reason, toolCalls.length),
      assistantMessage: { role: "assistant", text, toolCalls, raw: message.content },
    };
  }

  async complete(system: string, user: string): Promise<string> {
    const response = await this.client.messages.create({ model: this.model, max_tokens: 1000, system, messages: [{ role: "user", content: user }] });
    return response.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("");
  }
}

export function toAnthropicMessages(messages: NeutralMessage[]): Anthropic.MessageParam[] {
  return messages.map((m) => {
    if (m.role === "user") return { role: "user", content: m.text };
    if (m.role === "assistant") {
      if (m.raw) return { role: "assistant", content: m.raw as Anthropic.ContentBlockParam[] };
      return { role: "assistant", content: m.text || "(no text)" };
    }
    return {
      role: "user",
      content: m.results.map((r) => ({ type: "tool_result" as const, tool_use_id: r.callId, content: r.content, ...(r.isError ? { is_error: true } : {}) })),
    };
  });
}

function mapStop(reason: Anthropic.Message["stop_reason"], toolCalls: number): StopReason {
  if (reason === "tool_use" && toolCalls > 0) return "tool_use";
  if (reason === "max_tokens") return "max_tokens";
  if (reason === "refusal") return "refusal";
  return "end_turn";
}
