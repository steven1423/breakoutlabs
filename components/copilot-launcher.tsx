"use client";

const EXAMPLES = [
  "customers whose results are ready but haven't logged in for 7 days",
  "where is kit BL-4471-XK",
  "how many kits are stuck right now and why",
  "send everyone in results_locked a text",
];

/** Opens the copilot dock, with a question already typed when one is given. */
export function openCopilot(question?: string) {
  window.dispatchEvent(new CustomEvent("copilot:open", { detail: { question } }));
}

/**
 * The copilot's place on the page: what it does, in one line, and four questions that open the
 * dock and ask straight away. The dock itself lives in the shell; this is its front door.
 */
export function CopilotLauncher({ configured, label }: { configured: boolean; label: string }) {
  return (
    <section aria-label="Copilot" className="mt-8 grid gap-5 rounded-panel border border-brand/50 bg-surface p-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,2fr)]">
      <div className="flex gap-4">
        <span aria-hidden="true" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand/10">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="var(--brand)"><path d="M12 2l1.9 6.1L20 10l-6.1 1.9L12 18l-1.9-6.1L4 10l6.1-1.9z" /><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z" opacity="0.7" /></svg>
        </span>
        <div>
          <p className="text-24">Ask the copilot</p>
          <p className="mt-1 text-15 text-muted">
            Plain English in, an answer with every database call it made underneath. It reads through typed tools and one guarded query as a role that only sees masked views; it never sends anything, it proposes and you confirm.
          </p>
          <button type="button" onClick={() => openCopilot()} disabled={!configured} className="mt-3 rounded-control bg-brand px-4 py-2 text-15 font-medium text-on-brand disabled:opacity-60">
            {configured ? "Open the copilot" : `Copilot not configured (${label})`}
          </button>
        </div>
      </div>
      <div>
        <p className="text-13 text-muted">Try one</p>
        <ul className="mt-2 grid gap-2 sm:grid-cols-2">
          {EXAMPLES.map((q) => (
            <li key={q}>
              <button type="button" onClick={() => openCopilot(q)} disabled={!configured} className="w-full rounded-control border border-line bg-bg px-3 py-2 text-left text-15 hover:border-brand disabled:opacity-50">
                {q}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
