import { describe, expect, it } from "vitest";
import { dataset } from "./helpers";

describe("no real customer data", () => {
  it("every email is masked and no row carries a full address", () => {
    const d = dataset();
    for (const c of d.customers) expect(c.email_masked).toMatch(/^[a-z]\*\*\*@[a-z.]+$/);
    const blob = JSON.stringify(d);
    expect(blob).not.toMatch(/[a-z0-9._-]{2,}@[a-z0-9.-]+\.[a-z]{2,}/i);
  });

  it("stores no photos, only a quality score", () => {
    for (const c of dataset().checkins) expect(Object.keys(c)).not.toContain("photo");
  });
});
