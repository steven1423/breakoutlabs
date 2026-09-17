import { afterEach, describe, expect, it, vi } from "vitest";
import { copilotEffort, copilotKeyName, copilotLabel, copilotModel, copilotProvider, isCopilotConfigured } from "@/lib/copilot/env";

afterEach(() => vi.unstubAllEnvs());

describe("copilot env", () => {
  it("defaults to Anthropic and claude-sonnet-5", () => {
    vi.stubEnv("MODEL_PROVIDER", "");
    vi.stubEnv("CLAUDE_MODEL", "");
    expect(copilotProvider()).toBe("anthropic");
    expect(copilotModel()).toBe("claude-sonnet-5");
    expect(copilotKeyName()).toBe("ANTHROPIC_API_KEY");
    vi.stubEnv("CLAUDE_MODEL", "claude-opus-5");
    expect(copilotModel()).toBe("claude-opus-5");
  });

  it("switches to Gemini with its own model and key", () => {
    vi.stubEnv("MODEL_PROVIDER", "gemini");
    vi.stubEnv("GEMINI_MODEL", "");
    expect(copilotProvider()).toBe("gemini");
    expect(copilotModel()).toBe("gemini-2.5-flash");
    expect(copilotKeyName()).toBe("GEMINI_API_KEY");
    vi.stubEnv("GEMINI_API_KEY", "");
    expect(isCopilotConfigured()).toBe(false);
    vi.stubEnv("GEMINI_API_KEY", "k");
    expect(isCopilotConfigured()).toBe(true);
    expect(copilotLabel()).toBe("Gemini gemini-2.5-flash");
    vi.stubEnv("MODEL_PROVIDER", "nonsense");
    expect(copilotProvider()).toBe("anthropic");
  });

  it("accepts the five effort levels and falls back to medium otherwise", () => {
    for (const level of ["low", "medium", "high", "xhigh", "max"]) {
      vi.stubEnv("CLAUDE_EFFORT", level);
      expect(copilotEffort()).toBe(level);
    }
    vi.stubEnv("CLAUDE_EFFORT", "turbo");
    expect(copilotEffort()).toBe("medium");
  });
});
