export const EFFORT_LEVELS = ["low", "medium", "high", "xhigh", "max"] as const;
export type Effort = (typeof EFFORT_LEVELS)[number];

export const DEFAULT_MODEL = "claude-sonnet-5";
export const DEFAULT_EFFORT: Effort = "medium";

/** Model id from CLAUDE_MODEL (CLAUDE.md §3). */
export function copilotModel(): string {
  return process.env.CLAUDE_MODEL?.trim() || DEFAULT_MODEL;
}

/** Effort from CLAUDE_EFFORT; anything outside the five levels falls back to medium. */
export function copilotEffort(): Effort {
  const value = process.env.CLAUDE_EFFORT?.trim().toLowerCase();
  return (EFFORT_LEVELS as readonly string[]).includes(value ?? "") ? (value as Effort) : DEFAULT_EFFORT;
}

export function isCopilotConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}
