import { describe, expect, it } from "vitest";
import { parseQuery } from "@/app/api/aggregates/route";

const q = (s: string) => parseQuery(new URLSearchParams(s));

describe("aggregates route parsing", () => {
  it("accepts known dimensions, measures and filters", () => {
    expect(q("dims=segment,region_state&measure=share")).toEqual({ query: { dimensions: ["segment", "region_state"], measure: "share", marker: undefined, filter: undefined } });
    expect(q("measure=marker_delta&marker=insulin&intervention=supplement")).toMatchObject({ query: { dimensions: [], measure: "marker_delta", marker: "insulin", filter: { interventionType: "supplement" } } });
  });

  it("rejects unknown dimensions, measures, markers and interventions", () => {
    expect(q("dims=email_masked")).toEqual({ error: "Unknown dimension: email_masked" });
    expect(q("dims=segment&measure=rows")).toEqual({ error: "Unknown measure: rows" });
    expect(q("measure=marker_delta")).toEqual({ error: "marker_delta needs a marker" });
    expect(q("intervention=magic")).toEqual({ error: "Unknown intervention: magic" });
  });

  it("rejects a query specific enough to be a per-customer dump", () => {
    const seven = q("dims=segment,region_state,age_band,sex,month,plan,channel&measure=count");
    expect(seven).toHaveProperty("error");
    expect((seven as { error: string }).error).toMatch(/at most 3 dimensions and filters/);
    expect(q("dims=month,channel&segment=androgen&age_band=25-34&region_state=FL")).toHaveProperty("error");
    expect(q("dims=segment,age_band&region_state=FL")).toHaveProperty("query");
  });

  it("deduplicates repeated dimensions rather than counting them twice", () => {
    expect(q("dims=segment,segment,segment")).toEqual(q("dims=segment"));
  });

  it("has no parameter that yields rows: rows, limit, customer_id and format=rows change nothing", () => {
    const plain = q("dims=segment");
    expect(q("dims=segment&rows=1")).toEqual(plain);
    expect(q("dims=segment&limit=1&offset=0")).toEqual(plain);
    expect(q("dims=segment&customer_id=abc")).toEqual(plain);
    expect(q("dims=segment&format=rows")).toEqual(plain);
    expect(q("dims=segment&select=*")).toEqual(plain);
  });
});
