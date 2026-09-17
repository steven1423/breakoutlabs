import { createHash } from "node:crypto";
import { CUSTOMER_COUNT, SEED } from "./constants.ts";
import { generateCreators, type AttributionInsert, type CampaignInsert, type CreatorInsert } from "./creators.ts";
import { generatePeople, type CustomerRow } from "./customers.ts";
import { generateEngagement, type BlueprintInsert, type CheckinInsert, type InterventionInsert, type OutcomeInsert } from "./engagement.ts";
import { generateKits, type KitEventInsert, type KitInsert } from "./kits.ts";
import { generatePanels, type BiomarkerInsert, type PanelInsert, type SegmentInsert } from "./panels.ts";
import { Rng } from "./rng.ts";
import { generateTickets, type TicketInsert } from "./tickets.ts";

/** Every table the seed writes, in insert order (parents before children). */
export type SyntheticDataset = {
  customers: CustomerRow[];
  kits: KitInsert[];
  kit_events: KitEventInsert[];
  panels: PanelInsert[];
  biomarker_results: BiomarkerInsert[];
  customer_segments: SegmentInsert[];
  blueprints: BlueprintInsert[];
  interventions: InterventionInsert[];
  checkins: CheckinInsert[];
  outcomes: OutcomeInsert[];
  tickets: TicketInsert[];
  creators: CreatorInsert[];
  campaigns: CampaignInsert[];
  attributions: AttributionInsert[];
};

export type TableName = keyof SyntheticDataset;

/** Deterministic: the same seed always yields the same dataset, ids and timestamps included. */
export function generateDataset(seed: string = SEED, customerCount: number = CUSTOMER_COUNT): SyntheticDataset {
  const rng = new Rng(seed);
  const people = generatePeople(rng, customerCount);
  const bundles = generateKits(rng, people);
  const panels = generatePanels(rng, people, bundles);
  const engagement = generateEngagement(rng, bundles, panels.summaries);
  const tickets = generateTickets(rng, bundles);
  const creators = generateCreators(rng, people, bundles, panels.summaries);

  return {
    customers: people.map((p) => p.customer),
    kits: bundles.map((b) => b.kit),
    kit_events: bundles.flatMap((b) => b.events),
    panels: panels.panels,
    biomarker_results: panels.biomarkers,
    customer_segments: panels.segments,
    blueprints: engagement.blueprints,
    interventions: engagement.interventions,
    checkins: engagement.checkins,
    outcomes: engagement.outcomes,
    tickets,
    creators: creators.creators,
    campaigns: creators.campaigns,
    attributions: creators.attributions,
  };
}

export function rowCounts(dataset: SyntheticDataset): Record<TableName, number> {
  const counts = {} as Record<TableName, number>;
  for (const table of Object.keys(dataset) as TableName[]) counts[table] = dataset[table].length;
  return counts;
}

/** SHA-256 over the JSON of the whole dataset. Two seed runs must print the same value. */
export function checksum(dataset: SyntheticDataset): string {
  return createHash("sha256").update(JSON.stringify(dataset)).digest("hex");
}
