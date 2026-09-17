/**
 * Runs evals/copilot.json through the real copilot against the seeded database.
 * Usage: pnpm eval [caseId]   (needs the provider key from copilotKeyName() and the Supabase secret key)
 */
import { readFile } from "node:fs/promises";
import { createCopilot } from "../lib/copilot/index.ts";
import type { ToolCallRecord } from "../lib/copilot/loop.ts";

type Case = {
  id: string;
  question: string;
  tools?: string[];
  forbidden_tools?: string[];
  args?: Record<string, Record<string, unknown>>;
  answer_regex?: string;
  answer_regex_2?: string;
  not_regex?: string;
  min_calls?: Record<string, number>;
  max_calls?: number;
  answer_count_matches_rows?: string;
};

async function main() {
  const only = process.argv[2];
  const file = JSON.parse(await readFile("evals/copilot.json", "utf8")) as { cases: Case[] };
  const cases = file.cases.filter((c) => !only || c.id === only);
  const copilot = createCopilot();
  console.log(`provider ${copilot.provider.name}  model ${copilot.provider.model}\n`);
  let passed = 0;
  for (const c of cases) {
    const started = Date.now();
    const result = await copilot.ask(c.question);
    const failures = check(c, result.answer, result.calls);
    const ok = failures.length === 0;
    if (ok) passed++;
    console.log(`${ok ? "PASS" : "FAIL"} ${c.id} (${result.calls.length} calls, ${Date.now() - started} ms)`);
    for (const f of failures) console.log(`     - ${f}`);
    if (!ok) {
      console.log(`     stop: ${result.stopReason}${result.capped ? " (capped)" : ""}`);
      for (const k of result.calls) console.log(`     call ${k.index} ${k.name} ${k.error ? `error: ${k.error}` : `rows: ${k.rowCount ?? "-"}`}`);
      console.log(`     answer: ${result.answer.slice(0, 300).replace(/\n/g, " ")}`);
    }
  }
  console.log(`\n${passed}/${cases.length} passed`);
  if (passed !== cases.length) process.exitCode = 1;
}

function check(c: Case, answer: string, calls: ToolCallRecord[]): string[] {
  const failures: string[] = [];
  const names = calls.map((k) => k.name);
  for (const t of c.tools ?? []) if (!names.includes(t)) failures.push(`expected tool ${t}, got [${names.join(", ")}]`);
  for (const t of c.forbidden_tools ?? []) if (names.includes(t)) failures.push(`forbidden tool ${t} was called`);
  if (c.max_calls !== undefined && calls.length > c.max_calls) failures.push(`expected at most ${c.max_calls} calls, got ${calls.length}`);
  for (const [tool, min] of Object.entries(c.min_calls ?? {})) {
    const n = names.filter((x) => x === tool).length;
    if (n < min) failures.push(`expected at least ${min} ${tool} calls, got ${n}`);
  }
  for (const [tool, expected] of Object.entries(c.args ?? {})) {
    const call = calls.find((k) => k.name === tool);
    if (!call) continue;
    for (const [path, want] of Object.entries(expected)) failures.push(...checkArg(tool, call.input, path, want));
  }
  for (const key of ["answer_regex", "answer_regex_2"] as const) {
    if (c[key] && !new RegExp(c[key]!, "i").test(answer)) failures.push(`answer did not match /${c[key]}/i`);
  }
  if (c.not_regex && new RegExp(c.not_regex, "i").test(answer)) failures.push(`answer matched forbidden /${c.not_regex}/i`);
  if (c.answer_count_matches_rows) {
    // Ground truth is the last call of that tool that returned rows: a call that errored has none, and
    // the copilot is expected to retry it, so the answer is built from the retry.
    const call = calls.filter((k) => k.name === c.answer_count_matches_rows && !k.error).at(-1);
    const attempted = calls.some((k) => k.name === c.answer_count_matches_rows);
    const table = extractTable(answer);
    if (attempted && !call) failures.push(`every ${c.answer_count_matches_rows} call errored, so the answer has no ground truth`);
    if (call && table && table.length !== Math.min(call.rowCount ?? 0, 200)) failures.push(`answer table has ${table.length} rows, tool returned ${call.rowCount}`);
    if (call && !table && (call.rowCount ?? 0) > 0 && !answer.includes(String(call.rowCount))) failures.push(`answer states neither a table nor the count ${call.rowCount}`);
  }
  return failures;
}

function checkArg(tool: string, input: unknown, path: string, want: unknown): string[] {
  const includes = path.endsWith("_includes");
  const value = dig(input, includes ? path.replace(/_includes$/, "") : path);
  if (includes) {
    const list = Array.isArray(value) ? value : value === undefined ? [] : [value];
    const missing = (want as unknown[]).filter((w) => !list.includes(w));
    return missing.length ? [`${tool} ${path}: missing ${missing.join(", ")} in ${JSON.stringify(list)}`] : [];
  }
  return JSON.stringify(value) === JSON.stringify(want) ? [] : [`${tool} ${path}: expected ${JSON.stringify(want)}, got ${JSON.stringify(value)}`];
}

function dig(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => (acc && typeof acc === "object" ? (acc as Record<string, unknown>)[key] : undefined), obj);
}

function extractTable(answer: string): unknown[] | null {
  const m = answer.match(/```json\s*([\s\S]*?)```/);
  if (!m) return null;
  try {
    const parsed = JSON.parse(m[1]);
    return Array.isArray(parsed.rows) ? parsed.rows : null;
  } catch {
    return null;
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
