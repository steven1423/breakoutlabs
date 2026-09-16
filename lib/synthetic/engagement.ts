import type { Database } from "../db/types.ts";
import { DAY_MS, TODAY_MS, type Segment } from "./constants.ts";
import { iso, type KitBundle } from "./kits.ts";
import type { PanelSummary } from "./panels.ts";
import type { Rng } from "./rng.ts";

type Tables = Database["public"]["Tables"];
export type BlueprintInsert = Tables["blueprints"]["Insert"] & { id: string };
export type InterventionInsert = Tables["interventions"]["Insert"] & { id: string };
export type CheckinInsert = Tables["checkins"]["Insert"] & { id: string };
export type OutcomeInsert = Tables["outcomes"]["Insert"];

export type EngagementOutput = {
  blueprints: BlueprintInsert[];
  interventions: InterventionInsert[];
  checkins: CheckinInsert[];
  outcomes: OutcomeInsert[];
};

const SUPPLEMENTS: Record<Segment, string[]> = {
  androgen: ["SUP-SPEARMINT", "SUP-ZINC-30"],
  insulin: ["SUP-INOSITOL", "SUP-BERBERINE"],
  cortisol: ["SUP-ASHWAGANDHA", "SUP-MAGNESIUM"],
  nutrient: ["SUP-D3-5000", "SUP-ZINC-30"],
  inflammation: ["SUP-OMEGA3", "SUP-CURCUMIN"],
  mixed: ["SUP-ZINC-30", "SUP-OMEGA3"],
};
const SKINCARE = ["SKN-BPO-5", "SKN-AZELAIC-15", "SKN-ADAPALENE-01", "SKN-SALICYLIC-2"];
const LIFESTYLE = ["LIFE-SLEEP-8H", "LIFE-LOW-GI", "LIFE-DAIRY-FREE", "LIFE-WALK-30"];
const SPECIALISTS = ["Dr. Lena Okafor", "Dr. Priya Raman", "Dr. Miguel Santos"];

const DRIVER_COPY: Record<Segment, string> = {
  androgen: "Elevated androgens are pushing sebum production; SHBG is low so more of it is active.",
  insulin: "Fasting insulin is above optimal, which raises androgen signalling in the skin.",
  cortisol: "Morning cortisol is high; stress hormones are driving inflammation and oil.",
  nutrient: "Vitamin D and zinc are below the range where skin heals well.",
  inflammation: "hs-CRP is elevated; systemic inflammation is amplifying every breakout.",
  mixed: "Two drivers are active at once, so the plan targets both.",
};

/**
 * Blueprints, interventions and weekly check-ins for every customer whose kit reached
 * blueprint_ready, plus an outcome row for every customer with a retest panel.
 */
export function generateEngagement(rng: Rng, bundles: KitBundle[], summaries: Map<string, PanelSummary>): EngagementOutput {
  const out: EngagementOutput = { blueprints: [], interventions: [], checkins: [], outcomes: [] };
  const baselineKits = bundles.filter((b) => b.kit.sequence_no === 1);

  for (const b of baselineKits) {
    const summary = summaries.get(b.kit.customer_id);
    const readyMs = b.enteredMs.blueprint_ready;
    if (!summary || readyMs === undefined) continue;
    const customerId = b.kit.customer_id;
    const segment = summary.person.segment;

    out.blueprints.push(blueprint(rng, customerId, summary.baseline.id, segment, readyMs));
    for (const sku of interventionSkus(rng, segment)) {
      out.interventions.push({ id: rng.uuid(), customer_id: customerId, type: typeOf(sku), sku, started_at: iso(readyMs + DAY_MS), ended_at: null });
    }

    const viewedMs = b.enteredMs.viewed;
    if (viewedMs === undefined) continue;
    const endMs = summary.retest ? Date.parse(summary.retest.collected_at) : TODAY_MS;
    const improves = summary.markersImproved > 0;
    const severities = checkinSeverities(rng, viewedMs, endMs, improves);
    severities.forEach(([atMs, severity]) => {
      out.checkins.push({
        id: rng.uuid(),
        customer_id: customerId,
        at: iso(atMs),
        photo_quality_score: rng.chance(0.7) ? Math.round(rng.float(0.45, 0.98) * 100) / 100 : null,
        severity_self_reported: severity,
      });
    });

    if (summary.retest && severities.length >= 2) {
      const delta = severities[severities.length - 1][1] - severities[0][1];
      out.outcomes.push({
        customer_id: customerId,
        baseline_panel_id: summary.baseline.id,
        retest_panel_id: summary.retest.id,
        markers_improved: summary.markersImproved,
        severity_delta: delta,
        improved: summary.markersImproved > 0 && delta <= -2,
        computed_at: summary.retest.resulted_at,
      });
    }
  }
  return out;
}

function blueprint(rng: Rng, customerId: string, panelId: string, segment: Segment, readyMs: number): BlueprintInsert {
  const approvedMs = readyMs + rng.int(2, 36) * 3_600_000;
  return {
    id: rng.uuid(),
    customer_id: customerId,
    panel_id: panelId,
    drafted_by: "system",
    status: "approved",
    content: {
      summary: DRIVER_COPY[segment],
      drivers: [segment],
      supplements: SUPPLEMENTS[segment],
      skincare: [rng.pick(SKINCARE)],
      lifestyle: [rng.pick(LIFESTYLE)],
    },
    approved_by: rng.pick(SPECIALISTS),
    approved_at: iso(approvedMs),
    created_at: iso(readyMs),
  };
}

function interventionSkus(rng: Rng, segment: Segment): string[] {
  const skus = [rng.pick(SUPPLEMENTS[segment])];
  if (rng.chance(0.7)) skus.push(rng.pick(SKINCARE));
  if (rng.chance(0.5)) skus.push(rng.pick(LIFESTYLE));
  return skus;
}

function typeOf(sku: string): Database["public"]["Enums"]["intervention_type"] {
  if (sku.startsWith("SUP-")) return "supplement";
  if (sku.startsWith("SKN-")) return "skincare";
  return "lifestyle";
}

/** Weekly self-reported severity 0–10, drifting down when the retest will show improvement. */
function checkinSeverities(rng: Rng, startMs: number, endMs: number, improves: boolean): [number, number][] {
  const weeks = Math.min(14, Math.floor((endMs - startMs) / (7 * DAY_MS)) + 1);
  const start = rng.int(5, 9);
  const finish = improves ? start - rng.int(2, 5) : start + rng.int(-1, 1);
  const rows: [number, number][] = [];
  for (let w = 0; w < weeks; w++) {
    const progress = weeks === 1 ? 0 : w / (weeks - 1);
    const noise = rng.int(-1, 1);
    const severity = Math.max(0, Math.min(10, Math.round(start + (finish - start) * progress + (w === 0 || w === weeks - 1 ? 0 : noise))));
    rows.push([startMs + w * 7 * DAY_MS, severity]);
  }
  return rows;
}
