import type { Database } from "../db/types.ts";

/**
 * The one read path for intelligence (CLAUDE.md §9). Rows in, guarded cells out, never rows.
 * 1. Only rows with consent_research count.
 * 2. Group by the requested dimensions.
 * 3. Any cell with count < minCohort is replaced by { suppressed: true } with no count and no value.
 * The minimum applies to the cohort a number describes: the cell at the requested grain.
 */

type Enums = Database["public"]["Enums"];
export type Segment = Enums["segment"];
export type Marker = Enums["marker"];
export type InterventionType = Enums["intervention_type"];

export const DIMENSIONS = ["segment", "region_state", "age_band", "sex", "month", "plan", "channel"] as const;
export type Dimension = (typeof DIMENSIONS)[number];

export const MEASURES = ["count", "share", "leading_segment", "retest_rate", "improved_rate", "marker_delta"] as const;
export type Measure = (typeof MEASURES)[number];

export const SEGMENTS: readonly Segment[] = ["androgen", "insulin", "cortisol", "nutrient", "inflammation", "mixed"];
export const MARKERS: readonly Marker[] = ["testosterone", "dhea_s", "shbg", "cortisol", "insulin", "vitamin_d", "zinc", "hs_crp"];
export const INTERVENTION_TYPES: readonly InterventionType[] = ["supplement", "skincare", "rx", "lifestyle"];

/** One consenting-or-not customer as the guard sees it. Never leaves the server. */
export type ResearchRow = {
  consent_research: boolean;
  segment: Segment;
  region_state: string;
  age_band: string;
  sex: string;
  month: string;
  plan: string;
  channel: string;
  retested: boolean;
  improved: boolean | null;
  /** Change from baseline to retest, sign-normalised so positive means toward optimal. */
  deltas: Partial<Record<Marker, number>>;
  interventionTypes: InterventionType[];
};

export type AggregateQuery = {
  dimensions: Dimension[];
  measure: Measure;
  marker?: Marker;
  filter?: { interventionType?: InterventionType; segment?: Segment; age_band?: string; region_state?: string };
};

export type Cell =
  | { dims: Record<string, string>; suppressed: false; count: number; value: number | null; label?: string }
  | { dims: Record<string, string>; suppressed: true; count: null; value: null };

export type AggregateResult = { cells: Cell[]; consented: number; total: number; minCohort: number };

export function guardedAggregate(rows: readonly ResearchRow[], query: AggregateQuery, minCohort: number): AggregateResult {
  const consented = rows.filter((r) => r.consent_research);
  const eligible = consented.filter((r) => matches(r, query));
  const groups = new Map<string, { dims: Record<string, string>; rows: ResearchRow[] }>();
  for (const row of eligible) {
    const dims = Object.fromEntries(query.dimensions.map((d) => [d, row[d]]));
    const key = query.dimensions.map((d) => row[d]).join("|");
    const group = groups.get(key) ?? { dims, rows: [] };
    group.rows.push(row);
    groups.set(key, group);
  }
  const parentTotals = parentCounts(groups, query.dimensions);
  const cells: Cell[] = [...groups.values()].map((g) => {
    const contributing = contributors(g.rows, query);
    if (contributing.length < minCohort) return { dims: g.dims, suppressed: true, count: null, value: null };
    return { dims: g.dims, suppressed: false, count: contributing.length, ...measure(contributing, g.dims, query, parentTotals) };
  });
  return { cells, consented: consented.length, total: rows.length, minCohort };
}

function matches(row: ResearchRow, query: AggregateQuery): boolean {
  const f = query.filter;
  if (!f) return true;
  if (f.interventionType && !row.interventionTypes.includes(f.interventionType)) return false;
  if (f.segment && row.segment !== f.segment) return false;
  if (f.age_band && row.age_band !== f.age_band) return false;
  if (f.region_state && row.region_state !== f.region_state) return false;
  return true;
}

/** The rows a measure is actually computed over; the minimum cohort is checked on these. */
function contributors(rows: ResearchRow[], query: AggregateQuery): ResearchRow[] {
  if (query.measure === "marker_delta") return rows.filter((r) => query.marker !== undefined && r.deltas[query.marker] !== undefined);
  if (query.measure === "improved_rate") return rows.filter((r) => r.improved !== null);
  return rows;
}

function measure(rows: ResearchRow[], dims: Record<string, string>, query: AggregateQuery, parents: Map<string, number>): { value: number | null; label?: string } {
  switch (query.measure) {
    case "count":
      return { value: rows.length };
    case "share": {
      const parent = parents.get(parentKey(dims, query.dimensions)) ?? rows.length;
      return { value: parent > 0 ? rows.length / parent : null };
    }
    case "leading_segment": {
      const counts = new Map<string, number>();
      for (const r of rows) counts.set(r.segment, (counts.get(r.segment) ?? 0) + 1);
      const [label, n] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
      return { value: n / rows.length, label };
    }
    case "retest_rate":
      return { value: rows.filter((r) => r.retested).length / rows.length };
    case "improved_rate":
      return { value: rows.filter((r) => r.improved === true).length / rows.length };
    case "marker_delta": {
      const values = rows.map((r) => r.deltas[query.marker!] as number);
      return { value: values.reduce((a, b) => a + b, 0) / values.length };
    }
  }
}

function parentKey(dims: Record<string, string>, dimensions: Dimension[]): string {
  return dimensions.slice(0, -1).map((d) => dims[d]).join("|");
}

function parentCounts(groups: Map<string, { dims: Record<string, string>; rows: ResearchRow[] }>, dimensions: Dimension[]): Map<string, number> {
  const totals = new Map<string, number>();
  for (const g of groups.values()) {
    const key = parentKey(g.dims, dimensions);
    totals.set(key, (totals.get(key) ?? 0) + g.rows.length);
  }
  return totals;
}

export function isDimension(value: string): value is Dimension {
  return (DIMENSIONS as readonly string[]).includes(value);
}

export function isMeasure(value: string): value is Measure {
  return (MEASURES as readonly string[]).includes(value);
}

/** Configurable, never below 2: a cohort of one is a row. */
export function normaliseMinCohort(value: unknown, fallback = 50): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(2, Math.min(500, Math.round(n)));
}
