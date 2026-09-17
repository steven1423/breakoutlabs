/**
 * The one seam between the copilot and a model vendor. The loop, tools, guard and UI only see these types.
 * Anthropic is the default (CLAUDE.md §3); Gemini is selectable for the demo (docs/DECISIONS.md, M3).
 */

export type ToolCall = { id: string; name: string; input: unknown; signature?: string };
export type ToolResultMessage = { callId: string; name: string; content: string; isError: boolean };

export type NeutralMessage =
  | { role: "user"; text: string }
  | { role: "assistant"; text: string; toolCalls: ToolCall[]; raw?: unknown }
  | { role: "tool_results"; results: ToolResultMessage[] };

export type ToolDefinition = { name: string; description: string; inputSchema: Record<string, unknown> };

export type StopReason = "end_turn" | "tool_use" | "max_tokens" | "refusal";

export type TurnParams = {
  system: string;
  messages: NeutralMessage[];
  tools: ToolDefinition[];
  /** False on the capped last turn: the model must answer without calling anything. */
  allowTools: boolean;
  onText?: (delta: string) => void;
};

export type TurnResult = {
  text: string;
  toolCalls: ToolCall[];
  stopReason: StopReason;
  /** The assistant message to append to history, carrying whatever the vendor needs for replay. */
  assistantMessage: NeutralMessage;
};

export interface ModelProvider {
  readonly name: "anthropic" | "gemini";
  readonly model: string;
  streamTurn(params: TurnParams): Promise<TurnResult>;
  /** One non-streaming completion for the ticket summariser. Returns the model's text. */
  complete(system: string, user: string): Promise<string>;
}

/** Errors worth one more try: rate limits and vendor overload. */
export function isRetryable(err: unknown): boolean {
  const { status, retryable } = (err as { status?: unknown; retryable?: unknown }) ?? {};
  return retryable === true || status === 429 || status === 503 || status === 529;
}

/** Thrown when the model returns no text and no tool call; the loop re-samples the turn. */
export class EmptyTurnError extends Error {
  readonly retryable = true;
  constructor(reason: string) {
    super(`The model returned an empty turn (${reason}).`);
  }
}
