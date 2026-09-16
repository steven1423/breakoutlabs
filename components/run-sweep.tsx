"use client";

import { useActionState } from "react";
import { runSweepAction, type SweepState } from "@/lib/ops/actions";

const initial: SweepState = { result: null, error: null };

/** Runs the stuck-kit sweep and says what it did. A second click reports zeros: the sweep is idempotent. */
export function RunSweep() {
  const [state, action, pending] = useActionState(runSweepAction, initial);
  return (
    <form action={action} className="flex flex-wrap items-center gap-4">
      <button
        type="submit"
        disabled={pending}
        className="rounded-control bg-accent px-4 py-2 text-15 font-medium text-white disabled:opacity-60"
      >
        {pending ? "Sweeping" : "Run sweep"}
      </button>
      {state.error ? <span className="text-15 text-seeded">Sweep failed: {state.error}</span> : null}
      {state.result ? (
        <span className="text-15 text-muted">
          Opened {state.result.ticketsOpened} tickets, classified {state.result.causesSet}, proposed {state.result.nudgesProposed} nudges.
          {" "}{state.result.stuck} kits stuck, {state.result.retention} in retention.
        </span>
      ) : null}
    </form>
  );
}
