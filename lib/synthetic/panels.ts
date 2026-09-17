import type { Database } from "../db/types.ts";
import { baselineValues, countImproved, driversFor, retestValues, type MarkerValue } from "./biomarkers.ts";
import { DAY_MS, type Marker } from "./constants.ts";
import type { Person } from "./customers.ts";
import { iso, type KitBundle } from "./kits.ts";
import type { Rng } from "./rng.ts";

export type PanelInsert = Database["public"]["Tables"]["panels"]["Insert"] & { id: string; sequence_no: number };
export type BiomarkerInsert = Database["public"]["Tables"]["biomarker_results"]["Insert"] & { id: string };
export type SegmentInsert = Database["public"]["Tables"]["customer_segments"]["Insert"];

/** Per customer: their panels in order plus what the retest showed. Feeds outcomes and attribution. */
export type PanelSummary = {
  person: Person;
  drivers: Marker[];
  baseline: PanelInsert;
  retest: PanelInsert | null;
  markersImproved: number;
};

export type PanelOutput = {
  panels: PanelInsert[];
  biomarkers: BiomarkerInsert[];
  segments: SegmentInsert[];
  summaries: Map<string, PanelSummary>;
};

export function generatePanels(rng: Rng, people: Person[], bundles: KitBundle[]): PanelOutput {
  const out: PanelOutput = { panels: [], biomarkers: [], segments: [], summaries: new Map() };
  const byCustomer = new Map<string, KitBundle[]>();
  for (const b of bundles) {
    const list = byCustomer.get(b.kit.customer_id) ?? [];
    list.push(b);
    byCustomer.set(b.kit.customer_id, list);
  }

  for (const person of people) {
    out.segments.push({
      customer_id: person.customer.id,
      primary_segment: person.segment,
      confidence: person.confidence,
      computed_at: person.customer.created_at,
    });
    const drivers = driversFor(rng, person.segment);
    const kits = (byCustomer.get(person.customer.id) ?? []).sort((a, b) => a.kit.sequence_no - b.kit.sequence_no);
    const resulted = kits.filter((k) => k.enteredMs.resulted !== undefined);
    if (resulted.length === 0) continue;

    const sex = person.customer.sex;
    const baseValues = baselineValues(rng, sex, drivers);
    const baseline = addPanel(rng, out, resulted[0], baseValues);

    let retest: PanelInsert | null = null;
    let markersImproved = 0;
    if (resulted[1]) {
      const improveProb = rng.float(0.6, 0.75);
      const retestVals = retestValues(rng, sex, baseValues, drivers, improveProb);
      retest = addPanel(rng, out, resulted[1], retestVals);
      markersImproved = countImproved(baseValues, retestVals, drivers);
    }
    out.summaries.set(person.customer.id, { person, drivers, baseline, retest, markersImproved });
  }
  return out;
}

function addPanel(rng: Rng, out: PanelOutput, bundle: KitBundle, values: MarkerValue[]): PanelInsert {
  const panel: PanelInsert = {
    id: rng.uuid(),
    kit_id: bundle.kit.id,
    customer_id: bundle.kit.customer_id,
    sequence_no: bundle.kit.sequence_no,
    collected_at: iso(bundle.enteredMs.registered! + 1 * DAY_MS),
    resulted_at: iso(bundle.enteredMs.resulted!),
  };
  out.panels.push(panel);
  for (const v of values) {
    out.biomarkers.push({ id: rng.uuid(), panel_id: panel.id, ...v });
  }
  return panel;
}
