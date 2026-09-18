import { humanise } from "@/lib/ops/queries";
import type { KitState } from "@/lib/state-machine/transitions";

/** The happy path in order; exceptions hang off the state they branch from; terminal states sit in a footer. */
const BRANCHES: Partial<Record<KitState, KitState>> = { ordered: "backordered", registered: "registration_mismatch", resulted: "results_locked" };
const TERMINAL: KitState[] = ["cancelled", "refunded"];
const PHASES: { label: string; sub: string; states: KitState[] }[] = [
  { label: "Fulfilment", sub: "Order to doorstep", states: ["ordered", "shipped", "delivered"] },
  { label: "Lab", sub: "Kit registered, sample in, results out", states: ["registered", "sample_received", "resulted"] },
  { label: "Results and plan", sub: "Blueprint drafted and read", states: ["blueprint_ready", "viewed"] },
  { label: "Retest loop", sub: "Check-ins to the 90-day retest", states: ["checkin_active", "retest_due", "retest_ordered"] },
];

export type StuckByState = Partial<Record<KitState, number>>;

/**
 * The kit lifecycle as four panels, one per phase, each holding its states in order with a bar
 * per state scaled to the busiest, the stuck count in garnet, and the exception states hanging
 * under the step they branch from.
 */
export function Pipeline({ counts, stuck, sla }: { counts: Record<KitState, number>; stuck: StuckByState; sla: Partial<Record<KitState, number | null>> }) {
  const max = Math.max(1, ...PHASES.flatMap((p) => p.states).map((s) => counts[s]));
  let index = 0;
  return (
    <section aria-label="Kits by lifecycle phase" className="mt-6">
      <div className="grid gap-4 xl:grid-cols-[3fr_3fr_2fr_3fr]">
        {PHASES.map((phase) => {
          const kits = phase.states.reduce((a, s) => a + counts[s] + (BRANCHES[s] ? counts[BRANCHES[s]!] : 0), 0);
          const stuckHere = phase.states.reduce((a, s) => a + (stuck[s] ?? 0) + (BRANCHES[s] ? stuck[BRANCHES[s]!] ?? 0 : 0), 0);
          return (
            <div key={phase.label} className={`rounded-panel border bg-surface p-4 ${stuckHere > 0 ? "border-accent/50" : "border-line"}`}>
              <div className="flex items-baseline justify-between gap-2 border-b border-line pb-2">
                <div>
                  <p className="text-18">{phase.label}</p>
                  <p className="text-13 text-muted">{phase.sub}</p>
                </div>
                <p className="text-13 text-muted">
                  {kits} kits{stuckHere > 0 ? <span className="text-accent">, {stuckHere} stuck</span> : null}
                </p>
              </div>
              <ol className="mt-3 grid gap-3" style={{ gridTemplateColumns: `repeat(${phase.states.length}, minmax(0, 1fr))` }}>
                {phase.states.map((state) => {
                  index++;
                  const branch = BRANCHES[state];
                  return (
                    <li key={state} className="flex min-w-0 flex-col gap-1">
                      <Step state={state} count={counts[state]} stuck={stuck[state] ?? 0} max={max} sla={sla[state] ?? null} index={index} />
                      {branch ? <Branch state={branch} count={counts[branch]} stuck={stuck[branch] ?? 0} sla={sla[branch] ?? null} /> : null}
                    </li>
                  );
                })}
              </ol>
            </div>
          );
        })}
      </div>
      <p className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-13 text-muted">
        <span><span aria-hidden="true" className="mr-1.5 inline-block h-2 w-2 rounded-full bg-live align-middle" />Kits inside their SLA</span>
        <span><span aria-hidden="true" className="mr-1.5 inline-block h-2 w-2 rounded-full bg-accent align-middle" />Past SLA and stuck</span>
        <span>Boxed rows are exception states, under the step they branch from.</span>
        <span>Terminal: {TERMINAL.map((s) => `${humanise(s)} ${counts[s]}`).join(", ")}.</span>
      </p>
    </section>
  );
}

function Step({ state, count, stuck, max, sla, index }: { state: KitState; count: number; stuck: number; max: number; sla: number | null; index: number }) {
  const width = `${Math.max(count > 0 ? 4 : 0, Math.round((count / max) * 100))}%`;
  const stuckWidth = `${Math.round((stuck / Math.max(1, count)) * 100)}%`;
  return (
    <div className="flex flex-col gap-1">
      <p className="truncate text-13 text-muted" title={humanise(state)}>
        <span className="mr-1">{index}</span>
        {humanise(state)}
      </p>
      <p className="whitespace-nowrap text-24 leading-none">
        {count}
        {stuck > 0 ? <span className="ml-1.5 align-middle text-13 text-accent">{stuck} stuck</span> : null}
      </p>
      <div className="h-1.5 w-full rounded-full bg-raised" aria-hidden="true">
        <div className="relative h-1.5 rounded-full bg-live" style={{ width }}>
          {stuck > 0 ? <div className="absolute right-0 top-0 h-1.5 rounded-r-full bg-accent" style={{ width: stuckWidth }} /> : null}
        </div>
      </div>
      <p className="text-13 text-muted">{sla === null ? "No SLA" : `SLA ${sla}h`}</p>
    </div>
  );
}

function Branch({ state, count, stuck, sla }: { state: KitState; count: number; stuck: number; sla: number | null }) {
  return (
    <div className={`mt-1 rounded-control border px-2 py-1.5 ${stuck > 0 ? "border-accent/60 bg-accent/5" : "border-line"}`}>
      <p className="text-13 leading-tight text-accent">{humanise(state)}</p>
      <p className="whitespace-nowrap text-18 leading-none">
        {count}
        {stuck > 0 ? <span className="ml-1.5 align-middle text-13 text-accent">{stuck} stuck</span> : null}
      </p>
      <p className="text-13 text-muted">{sla === null ? "No SLA" : `SLA ${sla}h`}</p>
    </div>
  );
}
