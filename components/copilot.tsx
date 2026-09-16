"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { TransparencyPanel } from "@/components/transparency-panel";
import type { CopilotEvent, ToolCallRecord } from "@/lib/copilot/loop";

type Turn = { role: "user" | "assistant"; text: string; calls: ToolCallRecord[]; capped: boolean; error?: string };

const EXAMPLES = [
  "customers whose results are ready but haven't logged in for 7 days",
  "where is kit BL-4471-XK",
  "how many kits are stuck right now and why",
  "retest rate by plan",
];

/** Plain-English questions over the database, with the answer streamed and every tool call shown. */
export function Copilot({ configured }: { configured: boolean }) {
  const router = useRouter();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);

  async function ask(q: string) {
    const text = q.trim();
    if (!text || busy) return;
    setQuestion("");
    setBusy(true);
    const history = turns.filter((t) => !t.error).map((t) => ({ role: t.role, content: t.text }));
    setTurns((prev) => [...prev, { role: "user", text, calls: [], capped: false }, { role: "assistant", text: "", calls: [], capped: false }]);
    const patch = (fn: (turn: Turn) => Turn) => setTurns((prev) => [...prev.slice(0, -1), fn(prev[prev.length - 1])]);

    try {
      const res = await fetch("/api/copilot", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question: text, history }) });
      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        patch((t) => ({ ...t, error: body.error ?? `HTTP ${res.status}` }));
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";
        for (const part of parts) {
          if (!part.startsWith("data: ")) continue;
          const event = JSON.parse(part.slice(6)) as CopilotEvent;
          if (event.type === "text") patch((t) => ({ ...t, text: t.text + event.delta }));
          else if (event.type === "tool_call") patch((t) => ({ ...t, calls: [...t.calls, event.call] }));
          else if (event.type === "done") patch((t) => ({ ...t, text: event.answer, calls: event.calls, capped: event.capped }));
          else if (event.type === "error") patch((t) => ({ ...t, error: event.message }));
        }
      }
      router.refresh();
    } catch (err) {
      patch((t) => ({ ...t, error: err instanceof Error ? err.message : "Request failed" }));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 rounded-panel border border-line">
      <div className="flex flex-col gap-4 px-4 py-4">
        {turns.length === 0 ? (
          <div className="text-15 text-muted">
            <p>Ask in plain English. Every answer shows the tool calls it used.</p>
            <ul className="mt-2 flex flex-wrap gap-2">
              {EXAMPLES.map((e) => (
                <li key={e}>
                  <button type="button" onClick={() => ask(e)} disabled={!configured || busy} className="rounded-control border border-line px-3 py-1 text-13 hover:border-text disabled:opacity-50">{e}</button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {turns.map((t, i) => (
          <div key={i} className={t.role === "user" ? "text-15" : "text-15"}>
            <p className="text-13 text-muted">{t.role === "user" ? "You" : "Copilot"}</p>
            {t.role === "user" ? <p>{t.text}</p> : <Answer text={t.text} />}
            {t.error ? <p className="mt-1 text-seeded">Failed: {t.error}</p> : null}
            {t.role === "assistant" && (t.calls.length > 0 || t.text) ? <TransparencyPanel calls={t.calls} capped={t.capped} /> : null}
          </div>
        ))}
      </div>
      <form
        className="flex gap-2 border-t border-line px-4 py-3"
        onSubmit={(e) => {
          e.preventDefault();
          void ask(question);
        }}
      >
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder={configured ? "Ask about kits, customers, tickets or metrics" : "Copilot not configured: set ANTHROPIC_API_KEY"}
          disabled={!configured || busy}
          aria-label="Question for the copilot"
          className="flex-1 rounded-control border border-line bg-bg px-3 py-2 text-15 disabled:opacity-60"
        />
        <button type="submit" disabled={!configured || busy || !question.trim()} className="rounded-control bg-accent px-4 py-2 text-15 font-medium text-white disabled:opacity-60">
          {busy ? "Thinking" : "Ask"}
        </button>
      </form>
    </div>
  );
}

type Table = { columns: string[]; rows: unknown[][] };

/** Renders the answer text, turning a fenced json table block into a real table. */
function Answer({ text }: { text: string }) {
  const parts = splitTables(text);
  return (
    <div className="flex flex-col gap-2">
      {parts.map((p, i) =>
        typeof p === "string" ? (
          <p key={i} className="whitespace-pre-wrap">{p}</p>
        ) : (
          <div key={i} className="overflow-auto rounded-panel border border-line">
            <table className="w-full text-13">
              <thead className="bg-surface text-left text-muted">
                <tr>{p.columns.map((c) => <th key={c} className="px-3 py-1 font-medium">{c}</th>)}</tr>
              </thead>
              <tbody>
                {p.rows.map((r, ri) => (
                  <tr key={ri} className="border-t border-line">
                    {r.map((cell, ci) => <td key={ci} className="px-3 py-1">{cell === null || cell === undefined ? "" : String(cell)}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ),
      )}
    </div>
  );
}

function splitTables(text: string): (string | Table)[] {
  const out: (string | Table)[] = [];
  const re = /```json\s*([\s\S]*?)```/g;
  let last = 0;
  for (const match of text.matchAll(re)) {
    const before = text.slice(last, match.index).trim();
    if (before) out.push(before);
    try {
      const parsed = JSON.parse(match[1]) as Partial<Table>;
      if (Array.isArray(parsed.columns) && Array.isArray(parsed.rows)) out.push({ columns: parsed.columns, rows: parsed.rows });
      else out.push(match[0]);
    } catch {
      out.push(match[0]);
    }
    last = (match.index ?? 0) + match[0].length;
  }
  const tail = text.slice(last).trim();
  if (tail) out.push(tail);
  return out;
}
