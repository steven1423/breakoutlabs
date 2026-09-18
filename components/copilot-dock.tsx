"use client";

import { useEffect, useRef, useState } from "react";
import { Copilot } from "@/components/copilot";

/**
 * The copilot as a dock: a button in the bottom-right corner on every page that opens a panel
 * with the same chat and transparency panel. It lives in the shell so the conversation survives
 * navigation between pages. Esc closes it.
 */
export function CopilotDock({ configured, label }: { configured: boolean; label: string }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<{ id: number; text: string } | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onOpen = (e: Event) => {
      const question = (e as CustomEvent<{ question?: string }>).detail?.question;
      setOpen(true);
      if (question) setPending({ id: Date.now(), text: question });
    };
    window.addEventListener("copilot:open", onOpen);
    return () => window.removeEventListener("copilot:open", onOpen);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    panelRef.current?.querySelector<HTMLElement>("input, button")?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="copilot-panel"
        className="fixed bottom-6 right-6 z-30 flex items-center gap-2 rounded-full border border-line bg-surface py-2 pl-3 pr-4 text-15 shadow-none hover:bg-raised"
      >
        <Spark />
        <span>{open ? "Close the copilot" : "Ask the copilot"}</span>
      </button>

      <div
        id="copilot-panel"
        ref={panelRef}
        role="dialog"
        aria-label="Copilot"
        inert={!open}
        className={`fixed inset-y-0 right-0 z-20 flex w-full max-w-[520px] flex-col border-l border-line bg-bg transition-transform duration-200 ${open ? "translate-x-0" : "translate-x-full"}`}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div>
            <p className="text-18">Copilot</p>
            <p className="text-13 text-muted">Ask about kits, customers, tickets or metrics. It reads through typed tools and one guarded query; it never sends anything, it proposes.</p>
          </div>
          <button type="button" onClick={() => setOpen(false)} className="rounded-control border border-line px-2 py-1 text-13 text-muted hover:text-text">Close</button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-24 pt-2">
          <Copilot configured={configured} label={label} pending={pending} />
        </div>
      </div>
    </>
  );
}

/** A four-point spark, the one icon in the shell: it marks the thing that answers questions. */
function Spark() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="var(--accent)">
      <path d="M12 2l1.9 6.1L20 10l-6.1 1.9L12 18l-1.9-6.1L4 10l6.1-1.9z" />
      <path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z" opacity="0.7" />
    </svg>
  );
}
