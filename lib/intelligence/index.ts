import { createServiceSupabase, type ServiceClient } from "../db/service.ts";
import { guardedAggregate, type AggregateQuery, type AggregateResult } from "./guard.ts";
import { loadResearchRows } from "./queries.ts";
import { loadMinCohort } from "./settings.ts";

/** Load once, aggregate many: the page and the route both go through here. */
export async function openIntelligence(db: ServiceClient = createServiceSupabase()) {
  const [rows, minCohort] = await Promise.all([loadResearchRows(db), loadMinCohort(db)]);
  return {
    minCohort,
    total: rows.length,
    consented: rows.filter((r) => r.consent_research).length,
    aggregate(query: AggregateQuery): AggregateResult {
      return guardedAggregate(rows, query, minCohort);
    },
  };
}

export type Intelligence = Awaited<ReturnType<typeof openIntelligence>>;
