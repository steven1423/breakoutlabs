export const EFFORT_LEVELS = ["low", "medium", "high", "xhigh", "max"] as const;
export type Effort = (typeof EFFORT_LEVELS)[number];

export const PROVIDERS = ["anthropic", "gemini"] as const;
export type ProviderName = (typeof PROVIDERS)[number];

export const DEFAULT_MODEL = "claude-sonnet-5";
export const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";
export const DEFAULT_EFFORT: Effort = "medium";

/** Which vendor answers. Anthropic is the CLAUDE.md default; gemini is the demo override (docs/DECISIONS.md). */
export function copilotProvider(): ProviderName {
  const value = process.env.MODEL_PROVIDER?.trim().toLowerCase();
  return value === "gemini" ? "gemini" : "anthropic";
}

/** Model id for the selected provider: CLAUDE_MODEL or GEMINI_MODEL. */
export function copilotModel(): string {
  if (copilotProvider() === "gemini") return process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL;
  return process.env.CLAUDE_MODEL?.trim() || DEFAULT_MODEL;
}

/** Effort from CLAUDE_EFFORT; anything outside the five levels falls back to medium. */
export function copilotEffort(): Effort {
  const value = process.env.CLAUDE_EFFORT?.trim().toLowerCase();
  return (EFFORT_LEVELS as readonly string[]).includes(value ?? "") ? (value as Effort) : DEFAULT_EFFORT;
}

/** The env var the selected provider needs. */
export function copilotKeyName(): string {
  return copilotProvider() === "gemini" ? "GEMINI_API_KEY" : "ANTHROPIC_API_KEY";
}

export function isCopilotConfigured(): boolean {
  return Boolean(process.env[copilotKeyName()]);
}

/** Shown in the badge reason so the viewer knows which model answered. */
export function copilotLabel(): string {
  return `${copilotProvider() === "gemini" ? "Gemini" : "Claude"} ${copilotModel()}`;
}
