/**
 * Seeds the linked Supabase project with the deterministic synthetic dataset (CLAUDE.md §12).
 * Wipes the synthetic tables first, so running it twice yields identical rows.
 * Talks to PostgREST over HTTPS with the secret key; nothing here needs a Postgres port.
 *
 * Usage: pnpm seed   (needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY)
 */
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../lib/db/types.ts";
import { checksum, generateDataset, rowCounts, type SyntheticDataset, type TableName } from "../lib/synthetic/index.ts";

const BATCH = 500;

/** Insert order: parents before children. */
const ORDER: TableName[] = [
  "customers", "kits", "kit_events", "panels", "biomarker_results", "customer_segments",
  "blueprints", "interventions", "checkins", "outcomes", "tickets", "creators", "campaigns", "attributions",
];

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env: ${name}`);
  return value;
}

async function main() {
  const db = createClient<Database>(required("NEXT_PUBLIC_SUPABASE_URL"), required("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const dataset = generateDataset();
  console.log(`checksum ${checksum(dataset)}`);

  const reset = await db.rpc("reset_synthetic_data");
  if (reset.error) throw new Error(`reset failed: ${reset.error.message}`);

  for (const table of ORDER) await insertAll(db, table, dataset[table]);

  const expected = rowCounts(dataset);
  for (const table of ORDER) {
    const { count, error } = await db.from(table).select("*", { count: "exact", head: true });
    if (error) throw new Error(`count ${table}: ${error.message}`);
    const ok = count === expected[table] ? "ok " : "MISMATCH";
    console.log(`${ok} ${table.padEnd(18)} ${String(count).padStart(6)}`);
    if (count !== expected[table]) process.exitCode = 1;
  }
}

async function insertAll<T extends TableName>(db: ReturnType<typeof createClient<Database>>, table: T, rows: SyntheticDataset[T]) {
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH) as Database["public"]["Tables"][T]["Insert"][];
    const { error } = await db.from(table).insert(batch as never);
    if (error) throw new Error(`insert ${table} rows ${i}..${i + batch.length}: ${error.message}`);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
