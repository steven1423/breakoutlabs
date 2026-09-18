"use client";

import { useActionState } from "react";
import { setMinCohortAction, type MinCohortState } from "@/lib/intelligence/actions";

const initial: MinCohortState = { value: null, error: null };

type Props = { consentRate: number; consented: number; total: number; minCohort: number; exports: { label: string; href: string }[] };

/**
 * Guardrails (CLAUDE.md §9): the consent rate, the minimum cohort that every aggregate is checked against,
 * an export that only ever emits guarded cells, and a control that does not exist on purpose.
 */
export function Guardrails({ consentRate, consented, total, minCohort, exports }: Props) {
  const [state, action, pending] = useActionState(setMinCohortAction, initial);
  return (
    <aside className="flex flex-col gap-5 self-start rounded-panel border border-line bg-surface p-5 text-15">
      <p className="text-24">Guardrails</p>
      <div>
        <p className="text-13 text-muted">Research consent</p>
        <p className="text-24">{Math.round(consentRate * 100)}%</p>
        <p className="text-13 text-muted">{consented} of {total} synthetic customers. Only they count anywhere on this page.</p>
      </div>

      <form action={action} className="flex flex-col gap-2">
        <label htmlFor="min_cohort" className="text-13 text-muted">Minimum cohort per cell</label>
        <div className="flex gap-2">
          <input id="min_cohort" name="min_cohort" type="number" min={2} max={500} defaultValue={minCohort} className="w-24 rounded-control border border-line bg-bg px-3 py-2 text-15 text-text" />
          <button type="submit" disabled={pending} className="rounded-control bg-brand px-3 py-2 text-15 font-medium text-on-brand disabled:opacity-60">{pending ? "Saving" : "Save threshold"}</button>
        </div>
        <p className="text-13 text-muted">
          Cells with fewer people than this are never rendered or exported. Demo dataset: 500 customers, so the setting here is 10; the production default is 50.
          {state.value !== null ? ` Saved ${state.value}.` : ""}
          {state.error ? ` Could not save: ${state.error}` : ""}
        </p>
      </form>

      <div className="flex flex-col gap-2">
        {exports.map((e) => (
          <a key={e.href} href={e.href} className="rounded-control border border-line px-3 py-2 text-center hover:bg-raised">{e.label}</a>
        ))}
        <p className="text-13 text-muted">Row-level export</p>
        <button type="button" disabled title="Row-level export does not exist in this system." className="cursor-not-allowed rounded-control border border-line px-3 py-2 text-muted opacity-60">
          Export rows
        </button>
        <p className="text-13 text-muted">Row-level export does not exist in this system. Not disabled: absent.</p>
      </div>
    </aside>
  );
}
