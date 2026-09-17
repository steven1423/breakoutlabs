import type { ToolCallRecord } from "@/lib/copilot/loop";

/** A raw query returns one row whether it holds one record or the table, so the panel shows the payload size too. */
function formatBytes(bytes: number): string {
  return bytes < 1024 ? `${bytes} B` : `${Math.round(bytes / 1024)} KB`;
}

/** Every tool call behind an answer, in order: name, arguments, rows, elapsed, and the SQL for raw queries. */
export function TransparencyPanel({ calls, capped }: { calls: ToolCallRecord[]; capped: boolean }) {
  if (calls.length === 0) return <p className="text-13 text-muted">No tool calls. The answer used nothing from the database.</p>;
  return (
    <details className="mt-2 rounded-panel border border-line bg-surface text-13" open>
      <summary className="cursor-pointer px-4 py-2 text-muted">
        {calls.length} tool {calls.length === 1 ? "call" : "calls"}{capped ? ", capped at 8" : ""}
      </summary>
      <ol className="divide-y divide-line">
        {calls.map((c) => (
          <li key={c.index} className="px-4 py-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span>
                <span className="text-muted">{c.index}. </span>
                {c.name}
              </span>
              <span className="text-muted">
                {c.error ? <span className="text-seeded">error</span> : `${c.rowCount ?? 0} rows`}{c.bytes === undefined ? "" : `, ${formatBytes(c.bytes)}`}, {c.ms} ms
              </span>
            </div>
            <pre className="mt-1 overflow-auto whitespace-pre-wrap break-all text-muted">{JSON.stringify(c.input)}</pre>
            {c.sql ? <pre className="mt-1 overflow-auto whitespace-pre-wrap break-all rounded-control bg-raised px-2 py-1">{c.sql}</pre> : null}
            {c.note ? <p className="mt-1 text-muted">{c.note}</p> : null}
            {c.error ? <p className="mt-1 text-seeded">{c.error}</p> : null}
          </li>
        ))}
      </ol>
    </details>
  );
}
