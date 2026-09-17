import type { Content, FinishReason, GenerateContentConfig, GenerateContentResponse, Part } from "@google/genai";
import type { Effort } from "../env.ts";
import { EmptyTurnError, type ModelProvider, type NeutralMessage, type StopReason, type ToolCall, type TurnParams, type TurnResult } from "../provider.ts";

type GenerateParams = { model: string; contents: Content[]; config?: GenerateContentConfig };

/** The slice of the Gemini SDK this provider uses. Tests pass a fake with the same shape. */
export type GeminiLikeClient = {
  models: {
    generateContentStream: (params: GenerateParams) => Promise<AsyncIterable<GenerateContentResponse>>;
    generateContent: (params: GenerateParams) => Promise<GenerateContentResponse>;
  };
};

/** CLAUDE_EFFORT mapped to a thinking budget in tokens; -1 lets the model decide. */
export const THINKING_BUDGET: Record<Effort, number> = { low: 0, medium: 1024, high: 4096, xhigh: -1, max: -1 };

const REFUSAL_REASONS: ReadonlySet<string> = new Set(["SAFETY", "RECITATION", "BLOCKLIST", "PROHIBITED_CONTENT", "SPII"]);

export class GeminiProvider implements ModelProvider {
  readonly name = "gemini" as const;

  readonly model: string;
  private readonly client: GeminiLikeClient;
  private readonly effort: Effort;

  constructor(client: GeminiLikeClient, model: string, effort: Effort) {
    this.client = client;
    this.model = model;
    this.effort = effort;
  }

  async streamTurn(params: TurnParams): Promise<TurnResult> {
    const stream = await this.client.models.generateContentStream({
      model: this.model,
      contents: toGeminiContents(params.messages),
      config: {
        systemInstruction: params.system,
        maxOutputTokens: 8000,
        // Deterministic tool selection: the copilot is a data tool, not a writer (docs/DECISIONS.md).
        temperature: 0,
        thinkingConfig: { thinkingBudget: THINKING_BUDGET[this.effort] },
        // No tools on the capped turn: the model can only answer.
        ...(params.allowTools && params.tools.length > 0
          ? { tools: [{ functionDeclarations: params.tools.map((t) => ({ name: t.name, description: t.description, parametersJsonSchema: t.inputSchema })) }] }
          : {}),
      },
    });

    let text = "";
    const parts: Part[] = [];
    let finish: FinishReason | undefined;
    let blocked = false;
    for await (const chunk of stream) {
      const candidate = chunk.candidates?.[0];
      if (chunk.promptFeedback?.blockReason) blocked = true;
      if (candidate?.finishReason) finish = candidate.finishReason;
      for (const part of candidate?.content?.parts ?? []) {
        if (part.thought) continue;
        parts.push(part);
        if (part.text) {
          text += part.text;
          params.onText?.(part.text);
        }
      }
    }

    const toolCalls: ToolCall[] = parts
      .filter((p) => p.functionCall)
      .map((p, i) => ({ id: p.functionCall!.id ?? `call_${i + 1}`, name: p.functionCall!.name ?? "", input: p.functionCall!.args ?? {}, signature: p.thoughtSignature }));
    // Gemini reports a malformed or dropped function call as an empty turn; re-sampling is the remedy.
    if (!blocked && text === "" && toolCalls.length === 0) throw new EmptyTurnError(finish ?? "no parts");
    return {
      text,
      toolCalls,
      stopReason: mapStop(finish, toolCalls.length, blocked),
      assistantMessage: { role: "assistant", text, toolCalls, raw: parts },
    };
  }

  /**
   * One-shot completion. Gemini occasionally returns an empty candidate; the streaming path
   * already re-samples those, so this one does too rather than surfacing a blank answer.
   */
  async complete(system: string, user: string): Promise<string> {
    for (let attempt = 0; ; attempt++) {
      const text = await this.completeOnce(system, user);
      if (text.trim() !== "" || attempt >= 2) return text;
    }
  }

  private async completeOnce(system: string, user: string): Promise<string> {
    const response = await this.client.models.generateContent({
      model: this.model,
      contents: [{ role: "user", parts: [{ text: user }] }],
      // Thinking tokens count against maxOutputTokens on Gemini, so the limit must leave room for both.
      config: { systemInstruction: system, maxOutputTokens: 8000, temperature: 0, responseMimeType: "application/json", thinkingConfig: { thinkingBudget: THINKING_BUDGET[this.effort] } },
    });
    return response.text ?? "";
  }
}

/** Neutral history to Gemini contents. Replayed assistant turns keep their original parts, thought signatures included. */
export function toGeminiContents(messages: NeutralMessage[]): Content[] {
  return messages.map((m) => {
    if (m.role === "user") return { role: "user", parts: [{ text: m.text }] };
    if (m.role === "assistant") {
      const parts = (m.raw as Part[] | undefined) ?? [{ text: m.text || "(no text)" }];
      return { role: "model", parts };
    }
    return {
      role: "user",
      parts: m.results.map((r) => ({
        functionResponse: { id: r.callId.startsWith("call_") ? undefined : r.callId, name: r.name, response: r.isError ? { error: r.content } : { output: parseMaybeJson(r.content) } },
      })),
    };
  });
}

function parseMaybeJson(content: string): unknown {
  try {
    return JSON.parse(content);
  } catch {
    return content;
  }
}

function mapStop(finish: FinishReason | undefined, toolCalls: number, blocked: boolean): StopReason {
  if (blocked) return "refusal";
  if (finish && REFUSAL_REASONS.has(finish)) return "refusal";
  if (finish === "MAX_TOKENS") return "max_tokens";
  if (toolCalls > 0) return "tool_use";
  return "end_turn";
}
