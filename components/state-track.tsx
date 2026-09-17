import { KIT_STATES, type KitState } from "@/lib/state-machine/transitions";
import { humanise } from "@/lib/ops/queries";

const EXCEPTIONS: ReadonlySet<KitState> = new Set(["backordered", "registration_mismatch", "results_locked", "cancelled", "refunded"]);

/**
 * The loop as a track: every state in lifecycle order with the number of kits sitting in it.
 * Exception states carry the garnet mark. M7 animates kits moving along it.
 */
export function StateTrack({ counts, activeState }: { counts: Record<KitState, number>; activeState?: KitState }) {
  return (
    <ol aria-label="Kits by state" className="mt-6 flex flex-wrap gap-2">
      {KIT_STATES.map((state) => {
        const exception = EXCEPTIONS.has(state);
        const active = state === activeState;
        return (
          <li
            key={state}
            className={`flex min-w-[7.5rem] flex-col rounded-control border px-3 py-2 ${
              active ? "border-live" : "border-line"
            } ${exception ? "bg-surface" : ""}`}
          >
            <span className={`text-13 ${exception ? "text-accent" : "text-muted"}`}>{humanise(state)}</span>
            <span className="text-18">{counts[state]}</span>
          </li>
        );
      })}
    </ol>
  );
}
