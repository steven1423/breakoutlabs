import Link from "next/link";
import { humanise } from "@/lib/ops/queries";
import { withPersona, type Persona } from "@/lib/personas";
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
const PEEK = 8;

/** One kit as the hover card shows it. */
export type KitPeek = { code: string; customer: string; hoursIn: number; stuck: boolean; hoursOver: number };
export type KitsByState = Partial<Record<KitState, KitPeek[]>>;

/**
 * The kit lifecycle as four panels, one per phase, each holding its states in order with a bar
 * per state scaled to the busiest, the stuck count in garnet, and the exception states hanging
 * under the step they branch from. Every number is a link to the filtered queue, and hovering
 * it lists the kits behind it, each a link to its timeline.
 */
export function Pipeline({ kits, sla, persona }: { kits: KitsByState; sla: Partial<Record<KitState, number | null>>; persona: Persona }) {
  const count = (s: KitState) => kits[s]?.length ?? 0;
  const stuckOf = (s: KitState) => (kits[s] ?? []).filter((k) => k.stuck);
  const max = Math.max(1, ...PHASES.flatMap((p) => p.states).map(count));
  let index = 0;
  return (
    <section aria-label="Kits by lifecycle phase" className="mt-6">
      <div className="grid gap-4 xl:grid-cols-[3fr_3fr_2fr_3fr]">
        {PHASES.map((phase) => {
          const all = phase.states.flatMap((s) => [s, ...(BRANCHES[s] ? [BRANCHES[s]!] : [])]);
          const total = all.reduce((a, s) => a + count(s), 0);
          const stuckHere = all.reduce((a, s) => a + stuckOf(s).length, 0);
          return (
            <div key={phase.label} className={`rounded-panel border bg-surface p-4 ${stuckHere > 0 ? "border-accent/50" : "border-line"}`}>
              <div className="flex items-baseline justify-between gap-2 border-b border-line pb-2">
                <div>
                  <p className="text-18">{phase.label}</p>
                  <p className="text-13 text-muted">{phase.sub}</p>
                </div>
                <p className="text-13 text-muted">
                  {total} kits{stuckHere > 0 ? <span className="text-accent">, {stuckHere} stuck</span> : null}
                </p>
              </div>
              <ol className="mt-3 grid gap-3" style={{ gridTemplateColumns: `repeat(${phase.states.length}, minmax(0, 1fr))` }}>
                {phase.states.map((state) => {
                  index++;
                  const branch = BRANCHES[state];
                  return (
                    <li key={state} className="flex min-w-0 flex-col gap-1">
                      <Step state={state} kits={kits[state] ?? []} max={max} sla={sla[state] ?? null} index={index} persona={persona} />
                      {branch ? <Branch state={branch} kits={kits[branch] ?? []} sla={sla[branch] ?? null} persona={persona} /> : null}
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
        <span>Hover a number to see the kits behind it; click it to open them in the queue.</span>
        <span>Terminal: {TERMINAL.map((s) => `${humanise(s)} ${count(s)}`).join(", ")}.</span>
      </p>
    </section>
  );
}

function Step({ state, kits, max, sla, index, persona }: { state: KitState; kits: KitPeek[]; max: number; sla: number | null; index: number; persona: Persona }) {
  const stuck = kits.filter((k) => k.stuck);
  const width = `${Math.max(kits.length > 0 ? 4 : 0, Math.round((kits.length / max) * 100))}%`;
  const stuckWidth = `${Math.round((stuck.length / Math.max(1, kits.length)) * 100)}%`;
  return (
    <div className="flex flex-col gap-1">
      <p className="truncate text-13 text-muted" title={humanise(state)}>
        <span className="mr-1">{index}</span>
        {humanise(state)}
      </p>
      <p className="flex flex-wrap items-baseline gap-x-1.5 whitespace-nowrap text-24 leading-none">
        <Count state={state} kits={kits} persona={persona} />
        {stuck.length > 0 ? <Count state={state} kits={stuck} persona={persona} stuckOnly /> : null}
      </p>
      <div className="h-1.5 w-full rounded-full bg-raised" aria-hidden="true">
        <div className="relative h-1.5 rounded-full bg-live" style={{ width }}>
          {stuck.length > 0 ? <div className="absolute right-0 top-0 h-1.5 rounded-r-full bg-accent" style={{ width: stuckWidth }} /> : null}
        </div>
      </div>
      <p className="text-13 text-muted">{sla === null ? "No SLA" : `SLA ${sla}h`}</p>
    </div>
  );
}

function Branch({ state, kits, sla, persona }: { state: KitState; kits: KitPeek[]; sla: number | null; persona: Persona }) {
  const stuck = kits.filter((k) => k.stuck);
  return (
    <div className={`mt-1 rounded-control border px-2 py-1.5 ${stuck.length > 0 ? "border-accent/60 bg-accent/5" : "border-line"}`}>
      <p className="text-13 leading-tight text-accent">{humanise(state)}</p>
      <p className="flex flex-wrap items-baseline gap-x-1.5 whitespace-nowrap text-18 leading-none">
        <Count state={state} kits={kits} persona={persona} />
        {stuck.length > 0 ? <Count state={state} kits={stuck} persona={persona} stuckOnly /> : null}
      </p>
      <p className="text-13 text-muted">{sla === null ? "No SLA" : `SLA ${sla}h`}</p>
    </div>
  );
}

/**
 * A number that is a link to the queue filtered to these kits, with a hover card listing the
 * first eight of them. The card also opens on keyboard focus, so it is reachable without a mouse.
 */
function Count({ state, kits, persona, stuckOnly }: { state: KitState; kits: KitPeek[]; persona: Persona; stuckOnly?: boolean }) {
  const href = withPersona(stuckOnly ? `/ops?state=${state}` : `/ops?view=kits&state=${state}`, persona);
  const label = stuckOnly ? `${kits.length} stuck` : String(kits.length);
  const title = `${kits.length} ${stuckOnly ? "stuck " : ""}${kits.length === 1 ? "kit" : "kits"} in ${humanise(state).toLowerCase()}`;
  if (kits.length === 0) return <span className={stuckOnly ? "text-13 text-accent" : ""}>{label}</span>;
  return (
    <span className="group relative inline-block">
      <Link href={href} aria-label={`${title}: open in the queue`} className={`rounded-control underline decoration-line decoration-1 underline-offset-4 hover:decoration-text ${stuckOnly ? "text-13 text-accent" : ""}`}>
        {label}
      </Link>
      <div role="tooltip" className="pointer-events-none invisible absolute left-0 top-full z-20 mt-1 w-72 rounded-panel border border-line bg-bg p-3 text-13 opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:visible group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:visible group-focus-within:opacity-100">
        <p className="text-muted">{title}</p>
        <ul className="mt-2 flex flex-col gap-1">
          {kits.slice(0, PEEK).map((k) => (
            <li key={k.code} className="flex items-baseline justify-between gap-2">
              <Link href={withPersona(`/ops/kits/${k.code}`, persona)} className="underline decoration-line underline-offset-4 hover:decoration-text">{k.code}</Link>
              <span className="truncate text-muted">{k.customer}</span>
              <span className={`shrink-0 ${k.stuck ? "text-accent" : "text-muted"}`}>{k.stuck ? `${Math.floor(k.hoursOver)}h over` : `${Math.floor(k.hoursIn)}h`}</span>
            </li>
          ))}
        </ul>
        {kits.length > PEEK ? <p className="mt-2 text-muted">and {kits.length - PEEK} more. Click the number to see them all.</p> : null}
      </div>
    </span>
  );
}
