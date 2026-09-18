import { humanise } from "@/lib/ops/queries";
import type { KitState } from "@/lib/state-machine/transitions";

/** The happy path in order; exceptions hang off the state they branch from; terminal states sit in a footer. */
const HAPPY_PATH: KitState[] = ["ordered", "shipped", "delivered", "registered", "sample_received", "resulted", "blueprint_ready", "viewed", "checkin_active", "retest_due", "retest_ordered"];
const BRANCHES: Partial<Record<KitState, KitState>> = { ordered: "backordered", registered: "registration_mismatch", resulted: "results_locked" };
const TERMINAL: KitState[] = ["cancelled", "refunded"];
const PHASES: { label: string; from: number; to: number }[] = [
  { label: "Fulfilment", from: 0, to: 3 },
  { label: "Lab", from: 3, to: 6 },
  { label: "Results and plan", from: 6, to: 8 },
  { label: "Retest loop", from: 8, to: 11 },
];

export type StuckByState = Partial<Record<KitState, number>>;

/**
 * The kit lifecycle as one track: eleven steps in order, a bar per step scaled to the busiest
 * step, the stuck count in garnet, and the three exception states hanging under the step they
 * branch from. This replaces a grid of cards that had no order to it.
 */
export function Pipeline({ counts, stuck, sla }: { counts: Record<KitState, number>; stuck: StuckByState; sla: Partial<Record<KitState, number | null>> }) {
  const max = Math.max(1, ...HAPPY_PATH.map((s) => counts[s]));
  return (
    <section aria-label="Kits by lifecycle state" className="mt-6 rounded-panel border border-line bg-surface p-5">
      <div className="overflow-x-auto">
        <div className="min-w-[1080px]">
          <ol className="grid grid-cols-11 gap-2">
            {PHASES.map((p) => (
              <li key={p.label} className="border-b border-line pb-2 text-13 text-muted" style={{ gridColumn: `${p.from + 1} / ${p.to + 1}` }}>
                {p.label}
              </li>
            ))}
          </ol>
          <ol className="mt-3 grid grid-cols-11 gap-2">
            {HAPPY_PATH.map((state, i) => (
              <li key={state} className="flex min-w-0 flex-col gap-1">
                <Step state={state} count={counts[state]} stuck={stuck[state] ?? 0} max={max} sla={sla[state] ?? null} index={i + 1} />
                {BRANCHES[state] ? <Branch state={BRANCHES[state]!} count={counts[BRANCHES[state]!]} stuck={stuck[BRANCHES[state]!] ?? 0} sla={sla[BRANCHES[state]!] ?? null} /> : null}
              </li>
            ))}
          </ol>
        </div>
      </div>
      <p className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-13 text-muted">
        <span><span aria-hidden="true" className="mr-1.5 inline-block h-2 w-2 rounded-full bg-live align-middle" />Kits inside their SLA</span>
        <span><span aria-hidden="true" className="mr-1.5 inline-block h-2 w-2 rounded-full bg-accent align-middle" />Past SLA and stuck</span>
        <span>Indented rows are exception states, listed under the step they branch from.</span>
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
        <span className="mr-1 text-muted/70">{index}</span>
        {humanise(state)}
      </p>
      <p className="text-24 leading-none">
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
    <div className={`mt-1 rounded-control border px-2 py-1.5 ${stuck > 0 ? "border-accent/60" : "border-line"}`}>
      <p className="truncate text-13 text-accent" title={humanise(state)}>{humanise(state)}</p>
      <p className="text-18 leading-none">
        {count}
        {stuck > 0 ? <span className="ml-1.5 align-middle text-13 text-accent">{stuck} stuck</span> : null}
      </p>
      <p className="text-13 text-muted">{sla === null ? "No SLA" : `SLA ${sla}h`}</p>
    </div>
  );
}
