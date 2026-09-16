/**
 * The only path by which the model's own SQL reaches the database (CLAUDE.md §7).
 * Pure and conservative: one SELECT, nothing else. The Postgres `copilot` role is the real
 * boundary; this guard exists so obvious misuse never leaves the process.
 */

export type GuardResult = { ok: true; sql: string } | { ok: false; reason: string };

const MAX_LENGTH = 4000;

/** Anything that writes, escalates, blocks, sleeps or reads files. Matched as whole words. */
const FORBIDDEN = new RegExp(
  "\\b(" +
    [
      "insert", "update", "delete", "merge", "drop", "alter", "create", "truncate", "grant", "revoke",
      "copy", "lock", "call", "do", "vacuum", "analyze", "analyse", "refresh", "listen", "notify",
      "set", "reset", "prepare", "execute", "deallocate", "into", "returning",
      "pg_sleep", "pg_read_file", "pg_read_binary_file", "pg_ls_dir", "pg_terminate_backend",
      "pg_cancel_backend", "lo_import", "lo_export", "dblink", "set_config", "current_setting",
    ].join("|") +
    ")\\b",
  "i",
);

export function guardSql(raw: string): GuardResult {
  const sql = raw.trim().replace(/;\s*$/, "").trim();
  if (sql.length === 0) return { ok: false, reason: "Empty query" };
  if (sql.length > MAX_LENGTH) return { ok: false, reason: `Query longer than ${MAX_LENGTH} characters` };
  if (sql.includes(";")) return { ok: false, reason: "Only one statement is allowed" };
  if (sql.includes("--") || sql.includes("/*")) return { ok: false, reason: "Comments are not allowed" };
  if (!/^(select|with)\b/i.test(sql)) return { ok: false, reason: "Only SELECT queries are allowed" };
  if (/\bfor\s+(update|share|no\s+key\s+update|key\s+share)\b/i.test(sql)) {
    return { ok: false, reason: "Row locks are not allowed" };
  }
  const forbidden = sql.match(FORBIDDEN);
  if (forbidden) return { ok: false, reason: `Keyword not allowed: ${forbidden[1].toLowerCase()}` };
  return { ok: true, sql };
}
