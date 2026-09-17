import { describe, expect, it } from "vitest";
import { checksum, generateDataset, rowCounts } from "@/lib/synthetic/index";
import { CUSTOMER_COUNT } from "@/lib/synthetic/constants";
import { dataset } from "./helpers";

describe("generateDataset", () => {
  it("is byte-identical across runs with the same seed", () => {
    const a = generateDataset();
    const b = generateDataset();
    expect(checksum(a)).toBe(checksum(b));
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("changes with the seed", () => {
    expect(checksum(generateDataset("breakoutos-v2", 50))).not.toBe(checksum(generateDataset("breakoutos-v1", 50)));
  });

  it("produces the target customer count and non-empty tables", () => {
    const counts = rowCounts(dataset());
    expect(counts.customers).toBe(CUSTOMER_COUNT);
    for (const [table, n] of Object.entries(counts)) expect(n, table).toBeGreaterThan(0);
  });

  it("gives every row an explicit id so the database never invents one", () => {
    const d = dataset();
    for (const table of ["customers", "kits", "kit_events", "panels", "biomarker_results", "tickets", "creators", "campaigns", "attributions"] as const) {
      for (const row of d[table]) expect(row.id, table).toMatch(/^[0-9a-f-]{36}$/);
    }
  });
});
