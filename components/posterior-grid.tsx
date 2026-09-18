import { betaCurve, betaInterval, posteriorMean, type Sampled } from "@/lib/allocator/thompson";

export type PosteriorCard = { id: string; handle: string; platform: string; posterior: Sampled; allocation: number; share: number; orders: number; retested: number };

const W = 240;
const H = 72;

/**
 * Every campaign's belief as a small multiple: the density of retest-per-order, the 90% credible
 * interval shaded, the mean as a tick and this week's random draw as the garnet line. A wide,
 * flat curve is a campaign we know little about; that is why it still gets money.
 */
export function PosteriorGrid({ cards }: { cards: PosteriorCard[] }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {cards.map((c) => (
        <li key={c.id} className="rounded-panel border border-line bg-surface p-4">
          <div className="flex items-baseline justify-between gap-2">
            <p className="min-w-0 break-words text-15">{c.handle}<span className="block text-13 text-muted">{c.platform}</span></p>
            <p className="shrink-0 text-15">${c.allocation.toLocaleString("en-US", { maximumFractionDigits: 0 })} <span className="text-13 text-muted">{Math.round(c.share * 100)}%</span></p>
          </div>
          <Curve posterior={c.posterior} />
          <Stats posterior={c.posterior} orders={c.orders} retested={c.retested} />
        </li>
      ))}
    </ul>
  );
}

function Curve({ posterior }: { posterior: Sampled }) {
  const points = betaCurve(posterior, 96);
  const peak = Math.max(...points.map((p) => p.y), 1e-9);
  const y = (v: number) => H - 4 - (v / peak) * (H - 10);
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${(p.x * W).toFixed(1)},${y(p.y).toFixed(1)}`).join(" ");
  const [lo, hi] = betaInterval(posterior);
  const inside = points.filter((p) => p.x >= lo && p.x <= hi);
  const band = inside.length ? `M${(lo * W).toFixed(1)},${H} ${inside.map((p) => `L${(p.x * W).toFixed(1)},${y(p.y).toFixed(1)}`).join(" ")} L${(hi * W).toFixed(1)},${H} Z` : "";
  const mean = posteriorMean(posterior) * W;
  const draw = posterior.sampled * W;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mt-2 h-[72px] w-full" preserveAspectRatio="none" role="img" aria-label={`Beta(${posterior.alpha}, ${posterior.beta}); mean ${(posteriorMean(posterior) * 100).toFixed(0)}%, 90% interval ${(lo * 100).toFixed(0)} to ${(hi * 100).toFixed(0)}%, sampled ${(posterior.sampled * 100).toFixed(0)}%`}>
      <line x1="0" x2={W} y1={H - 0.5} y2={H - 0.5} stroke="var(--line)" />
      {band ? <path d={band} fill="var(--live)" fillOpacity="0.18" /> : null}
      <path d={path} fill="none" stroke="var(--live)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
      <line x1={mean} x2={mean} y1={H - 10} y2={H} stroke="var(--text)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
      <line x1={draw} x2={draw} y1="2" y2={H} stroke="var(--accent)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function Stats({ posterior, orders, retested }: { posterior: Sampled; orders: number; retested: number }) {
  const [lo, hi] = betaInterval(posterior);
  return (
    <p className="mt-2 text-13 text-muted">
      {retested} of {orders} retested. Mean {Math.round(posteriorMean(posterior) * 100)}%, 90% interval {Math.round(lo * 100)} to {Math.round(hi * 100)}%. Draw{" "}
      <span className="text-accent">{Math.round(posterior.sampled * 100)}%</span>.
    </p>
  );
}
