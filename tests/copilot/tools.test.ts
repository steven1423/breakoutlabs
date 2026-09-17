import { describe, expect, it } from "vitest";
import { COPILOT_TOOLS, getMetric, getKitTimeline, listCustomers, proposeAction, RESULT_BYTE_CAP, runReadonlyQuery, searchCustomers, toAnthropicTools } from "@/lib/copilot/tools";
import type { ToolContext } from "@/lib/copilot/tools";

/** A database that answers the explain with a plan and the query with whatever rows the test hands it. */
function dbReturning(rows: unknown[]): ToolContext {
  const db = {
    rpc: (fn: string) => ({
      abortSignal: () => Promise.resolve(fn === "copilot_explain_query" ? { data: [{ Plan: {} }], error: null } : { data: rows, error: null }),
    }),
  };
  return { db, now: new Date(), summarizeTicket: async () => { throw new Error("not used"); } } as unknown as ToolContext;
}

describe("tool schemas", () => {
  it("exposes the nine §7 tools plus get_ticket, each with a JSON schema", () => {
    const names = toAnthropicTools().map((t) => t.name);
    expect(names).toEqual(["search_customers", "get_customer", "get_kit_timeline", "list_stuck_kits", "list_customers", "get_ticket", "summarize_ticket", "get_metric", "run_readonly_query", "propose_action"]);
    for (const t of toAnthropicTools()) expect(t.input_schema.type).toBe("object");
    expect(COPILOT_TOOLS.length).toBe(10);
  });

  it("rejects bad input", () => {
    expect(searchCustomers.schema.safeParse({}).success).toBe(false);
    expect(searchCustomers.schema.safeParse({ query: "" }).success).toBe(false);
    expect(getKitTimeline.schema.safeParse({ kit_code: "4471" }).success).toBe(false);
    expect(getKitTimeline.schema.safeParse({ kit_code: "BL-4471-XK" }).success).toBe(true);
    expect(getMetric.schema.safeParse({ name: "revenue" }).success).toBe(false);
    expect(getMetric.schema.safeParse({ name: "retest_rate", group_by: "plan" }).success).toBe(true);
    expect(proposeAction.schema.safeParse({ type: "send_email", customer_id: "x", payload: {} }).success).toBe(false);
    expect(runReadonlyQuery.schema.safeParse({ sql: "" }).success).toBe(false);
  });

  it("rejects unknown filter keys and wrong types on list_customers", () => {
    expect(listCustomers.schema.safeParse({ filter: { state: "resulted", days_since_last_login_gte: 7 } }).success).toBe(true);
    expect(listCustomers.schema.safeParse({ filter: { state: ["resulted", "blueprint_ready"] } }).success).toBe(true);
    expect(listCustomers.schema.safeParse({ filter: { state: "lost" } }).success).toBe(false);
    expect(listCustomers.schema.safeParse({ filter: { last_login: 7 } }).success).toBe(false);
    expect(listCustomers.schema.safeParse({ filter: { days_since_last_login_gte: "7" } }).success).toBe(false);
  });
});

describe("run_readonly_query size ceiling", () => {
  // The 200-row cap bounds rows, not bytes: one aggregating select is a single row holding the whole table.
  const wholeTable = [{ dump: "x".repeat(RESULT_BYTE_CAP) }];

  it("rejects one oversized row and says what to do instead", async () => {
    await expect(runReadonlyQuery.run({ sql: "select jsonb_agg(row_to_json(t)) from biomarker_results t" }, dbReturning(wholeTable)))
      .rejects.toThrow(/over the 131072 byte limit[\s\S]*Aggregate in SQL/);
  });

  it("passes an ordinary result through and reports its size", async () => {
    const result = await runReadonlyQuery.run({ sql: "select count(*) from customers" }, dbReturning([{ count: 500 }]));
    expect(result.rowCount).toBe(1);
    expect(result.bytes).toBe(JSON.stringify([{ count: 500 }]).length);
  });
});
