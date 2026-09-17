/**
 * Applies supabase/migrations/*.sql in name order through the Supabase Management API.
 * Why HTTPS and not `supabase db push`: the direct Postgres host is IPv6-only and unreachable
 * from the sandbox (docs/DECISIONS.md). Applied files are recorded in `schema_migrations`.
 *
 * Usage: pnpm migrate            (needs SUPABASE_ACCESS_TOKEN and SUPABASE_PROJECT_REF)
 */
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { runSql } from "./supabase-sql.mts";

const MIGRATIONS_DIR = path.resolve("supabase/migrations");

async function main() {
  await runSql(
    "create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())",
  );
  const applied = new Set(
    (await runSql<{ name: string }>("select name from schema_migrations")).map((r) => r.name),
  );
  const files = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith(".sql")).sort();

  for (const file of files) {
    if (applied.has(file)) {
      console.log(`skip    ${file}`);
      continue;
    }
    const sql = await readFile(path.join(MIGRATIONS_DIR, file), "utf8");
    await runSql(`${sql}\ninsert into schema_migrations (name) values ('${file}');`);
    console.log(`applied ${file}`);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
