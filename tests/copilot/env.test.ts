import { afterEach, describe, expect, it, vi } from "vitest";
import { copilotEffort, copilotModel } from "@/lib/copilot/env";

afterEach(() => vi.unstubAllEnvs());

describe("copilot env", () => {
  it("reads the model and falls back to claude-sonnet-5", () => {
    vi.stubEnv("CLAUDE_MODEL", "");
    expect(copilotModel()).toBe("claude-sonnet-5");
    vi.stubEnv("CLAUDE_MODEL", "claude-opus-5");
    expect(copilotModel()).toBe("claude-opus-5");
  });

  it("accepts the five effort levels and falls back to medium otherwise", () => {
    for (const level of ["low", "medium", "high", "xhigh", "max"]) {
      vi.stubEnv("CLAUDE_EFFORT", level);
      expect(copilotEffort()).toBe(level);
    }
    vi.stubEnv("CLAUDE_EFFORT", "turbo");
    expect(copilotEffort()).toBe("medium");
    vi.stubEnv("CLAUDE_EFFORT", "");
    expect(copilotEffort()).toBe("medium");
  });
});
