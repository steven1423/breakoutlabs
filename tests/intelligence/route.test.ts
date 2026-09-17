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

  it("has no parameter that yields rows: rows, limit, customer_id and format=rows change nothing", () => {
    const plain = q("dims=segment");
    expect(q("dims=segment&rows=1")).toEqual(plain);
    expect(q("dims=segment&limit=1&offset=0")).toEqual(plain);
    expect(q("dims=segment&customer_id=abc")).toEqual(plain);
    expect(q("dims=segment&format=rows")).toEqual(plain);
    expect(q("dims=segment&select=*")).toEqual(plain);
  });
});
