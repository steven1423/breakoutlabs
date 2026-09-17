import { createServiceSupabase, type ServiceClient } from "../db/service.ts";
import type { InterventionType, Marker, ResearchRow, Segment } from "./guard.ts";

/**
 * The one data load for intelligence. Returns every customer as a ResearchRow (consent flag included,
 * the guard filters). Server only; the rows are never returned from a route or passed to a client component.
 */
export async function loadResearchRows(db: ServiceClient = createServiceSupabase()): Promise<ResearchRow[]> {
  const [customers, segments, outcomes, interventions] = await Promise.all([
    db.from("customers").select("id, consent_research, region_state, age_band, sex, plan, acquisition_channel, created_at"),
    db.from("customer_segments").select("customer_id, primary_segment"),
    db.from("outcomes").select("customer_id, improved, baseline_panel_id, retest_panel_id"),
    db.from("interventions").select("customer_id, type"),
  ]);
  for (const r of [customers, segments, outcomes, interventions]) if (r.error) throw new Error(r.error.message);

  const panelIds = outcomes.data!.flatMap((o) => [o.baseline_panel_id, o.retest_panel_id]);
  const results = panelIds.length
    ? await db.from("biomarker_results").select("panel_id, marker, value, ref_low, ref_high").in("panel_id", panelIds)
    : { data: [], error: null };
  if (results.error) throw new Error(results.error.message);

  const byPanel = new Map<string, { marker: Marker; value: number; ref_low: number; ref_high: number }[]>();
  for (const r of results.data!) byPanel.set(r.panel_id, [...(byPanel.get(r.panel_id) ?? []), { marker: r.marker, value: Number(r.value), ref_low: Number(r.ref_low), ref_high: Number(r.ref_high) }]);

  const segmentOf = new Map(segments.data!.map((s) => [s.customer_id, s.primary_segment as Segment]));
  const outcomeOf = new Map(outcomes.data!.map((o) => [o.customer_id, o]));
  const typesOf = new Map<string, Set<InterventionType>>();
  for (const i of interventions.data!) typesOf.set(i.customer_id, new Set([...(typesOf.get(i.customer_id) ?? []), i.type as InterventionType]));

  return customers.data!.map((c) => {
    const outcome = outcomeOf.get(c.id);
    return {
      consent_research: c.consent_research,
      segment: segmentOf.get(c.id) ?? "mixed",
      region_state: c.region_state,
      age_band: c.age_band,
      sex: c.sex,
      month: c.created_at.slice(0, 7),
      plan: c.plan,
      channel: c.acquisition_channel,
      retested: Boolean(outcome),
      improved: outcome ? outcome.improved : null,
      deltas: outcome ? markerDeltas(byPanel.get(outcome.baseline_panel_id) ?? [], byPanel.get(outcome.retest_panel_id) ?? []) : {},
      interventionTypes: [...(typesOf.get(c.id) ?? [])],
    };
  });
}

type Result = { marker: Marker; value: number; ref_low: number; ref_high: number };

/** Retest minus baseline, with the sign flipped where the marker was high, so positive is always "toward optimal". */
export function markerDeltas(baseline: Result[], retest: Result[]): Partial<Record<Marker, number>> {
  const after = new Map(retest.map((r) => [r.marker, r.value]));
  const deltas: Partial<Record<Marker, number>> = {};
  for (const b of baseline) {
    const a = after.get(b.marker);
    if (a === undefined) continue;
    deltas[b.marker] = towardOptimal(b.value, a, b.ref_low, b.ref_high);
  }
  return deltas;
}

export function towardOptimal(before: number, after: number, refLow: number, refHigh: number): number {
  if (before > refHigh) return round2(before - after);
  if (before < refLow) return round2(after - before);
  const mid = (refLow + refHigh) / 2;
  return round2(Math.abs(before - mid) - Math.abs(after - mid));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
