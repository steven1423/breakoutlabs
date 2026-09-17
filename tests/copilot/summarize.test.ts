import { describe, expect, it } from "vitest";
import { aiSummarySchema } from "@/lib/copilot/summarize";

describe("aiSummarySchema", () => {
  it("accepts the §5 ai_summary shape and rejects an unknown cause", () => {
    const good = { summary: "Locked out.", likely_cause: "portal_lockout", evidence: ["kit ID invalid"], suggested_reply: "We relinked your kit." };
    expect(aiSummarySchema.safeParse(good).success).toBe(true);
    expect(aiSummarySchema.safeParse({ ...good, likely_cause: "gremlins" }).success).toBe(false);
    expect(aiSummarySchema.safeParse({ ...good, evidence: "kit ID invalid" }).success).toBe(false);
  });
});
