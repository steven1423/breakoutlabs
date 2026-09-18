"use client";

import { useActionState } from "react";
import { runAllocatorAction, type AllocatorState } from "@/lib/growth/actions";

const initial: AllocatorState = { run: null, error: null };

/** Budget input and the Run allocator button. Each run persists its posterior and allocation. */
export function RunAllocator({ defaultBudget }: { defaultBudget: number }) {
  const [state, action, pending] = useActionState(runAllocatorAction, initial);
  return (
    <form action={action} className="flex flex-wrap items-end gap-4">
      <label className="flex flex-col gap-1 text-13 text-muted">
        Weekly budget (USD)
        <input name="budget" type="number" min={100} step={100} defaultValue={defaultBudget} className="w-40 rounded-control border border-line bg-surface px-3 py-2 text-15 text-text" />
      </label>
      <button type="submit" disabled={pending} className="rounded-control bg-brand px-4 py-2 text-15 font-medium text-on-brand disabled:opacity-60">
        {pending ? "Sampling" : "Run allocator"}
      </button>
      {state.error ? <span className="text-15 text-seeded">Allocator failed: {state.error}</span> : null}
      {state.run ? <span className="text-15 text-muted">Allocated {state.run.budgetUsd.toLocaleString("en-US", { style: "currency", currency: "USD" })} across {Object.keys(state.run.allocation).length} campaigns.</span> : null}
    </form>
  );
}
