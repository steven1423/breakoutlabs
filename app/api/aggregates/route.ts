import { NextResponse } from "next/server";
import { cellsToCsv } from "@/lib/intelligence/csv";
import { INTERVENTION_TYPES, MARKERS, MAX_SPECIFICITY, SEGMENTS, TooSpecificError, isDimension, isMeasure, specificityOf, type AggregateQuery, type Dimension, type InterventionType, type Marker, type Segment } from "@/lib/intelligence/guard";
import { openIntelligence } from "@/lib/intelligence";

/**
 * Guarded aggregates (CLAUDE.md §9). GET ?dims=segment,region_state&measure=share&format=json|csv
 * There is no parameter that returns rows; anything unrecognised is ignored and the guard still applies.
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const parsed = parseQuery(params);
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
  try {
    const intel = await openIntelligence();
    const result = intel.aggregate(parsed.query);
    if (params.get("format") === "csv") {
      return new Response(cellsToCsv(result.cells, parsed.query.dimensions), {
        headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="aggregates-${parsed.query.dimensions.join("-") || "all"}.csv"` },
      });
    }
    return NextResponse.json({ query: parsed.query, minCohort: result.minCohort, consented: result.consented, cells: result.cells });
  } catch (err) {
    if (err instanceof TooSpecificError) return NextResponse.json({ error: err.message }, { status: 400 });
    return NextResponse.json({ error: err instanceof Error ? err.message : "Aggregate failed" }, { status: 500 });
  }
}

export function parseQuery(params: URLSearchParams): { query: AggregateQuery } | { error: string } {
  const dims = (params.get("dims") ?? "").split(",").map((d) => d.trim()).filter(Boolean);
  const unknown = dims.filter((d) => !isDimension(d));
  if (unknown.length) return { error: `Unknown dimension: ${unknown.join(", ")}` };
  const measure = params.get("measure") ?? "count";
  if (!isMeasure(measure)) return { error: `Unknown measure: ${measure}` };
  const marker = params.get("marker");
  if (measure === "marker_delta" && (!marker || !(MARKERS as readonly string[]).includes(marker))) return { error: "marker_delta needs a marker" };
  const filter: NonNullable<AggregateQuery["filter"]> = {};
  const intervention = params.get("intervention");
  if (intervention) {
    if (!(INTERVENTION_TYPES as readonly string[]).includes(intervention)) return { error: `Unknown intervention: ${intervention}` };
    filter.interventionType = intervention as InterventionType;
  }
  const segment = params.get("segment");
  if (segment) {
    if (!(SEGMENTS as readonly string[]).includes(segment)) return { error: `Unknown segment: ${segment}` };
    filter.segment = segment as Segment;
  }
  const ageBand = params.get("age_band");
  if (ageBand) filter.age_band = ageBand;
  const region = params.get("region_state");
  if (region) filter.region_state = region.toUpperCase().slice(0, 2);
  const query: AggregateQuery = { dimensions: [...new Set(dims)] as Dimension[], measure, marker: (marker as Marker) ?? undefined, filter: Object.keys(filter).length ? filter : undefined };
  const specificity = specificityOf(query);
  if (specificity > MAX_SPECIFICITY) return { error: new TooSpecificError(specificity).message };
  return { query };
}
