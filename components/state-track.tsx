import { KIT_STATES, type KitState } from "@/lib/state-machine/transitions";
import { humanise } from "@/lib/ops/queries";

const EXCEPTIONS: ReadonlySet<KitState> = new Set(["backordered", "registration_mismatch", "results_locked", "cancelled", "refunded"]);
export const MAX_MARKS = 24;

export type TrackMarks = Partial<Record<KitState, { stuck: number }>>;

/**
 * The loop as a track (CLAUDE.md §14): every state in lifecycle order with the kits sitting in it
 * as marks, garnet where the kit is past its SLA. Marks slide in once per page load; reduced motion skips it.
 */
export function StateTrack({ counts, marks, activeState }: { counts: Record<KitState, number>; marks?: TrackMarks; activeState?: KitState }) {
  let index = 0;
  return (
    <ol aria-label="Kits by state" className="mt-6 flex flex-wrap gap-2">
      {KIT_STATES.map((state) => {
        const exception = EXCEPTIONS.has(state);
        const active = state === activeState;
        const count = counts[state];
        const stuck = marks?.[state]?.stuck ?? 0;
        const shown = Math.min(count, MAX_MARKS);
        const overflow = count - shown;
        return (
          <li key={state} className={`flex min-w-[7.5rem] flex-col rounded-control border px-3 py-2 ${active ? "border-live" : "border-line"} ${exception ? "bg-surface" : ""}`}>
            <span className={`text-13 ${exception ? "text-accent" : "text-muted"}`}>{humanise(state)}</span>
            <span className="text-18">{count}{stuck > 0 ? <span className="ml-1 text-13 text-accent">{stuck} stuck</span> : null}</span>
            {marks ? (
              <span className="mt-1 flex flex-wrap gap-0.5" aria-hidden="true">
                {Array.from({ length: shown }, (_, i) => (
                  <span key={i} className={`rail-mark inline-block h-1.5 w-1.5 rounded-full ${i < stuck ? "bg-accent" : "bg-live"}`} style={{ ["--i" as string]: index++ }} />
                ))}
                {overflow > 0 ? <span className="text-13 text-muted">+{overflow}</span> : null}
              </span>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
