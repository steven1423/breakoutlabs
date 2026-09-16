import { betaCurve, type Sampled } from "@/lib/allocator/thompson";

const W = 160;
const H = 40;

/** A campaign's Beta posterior as a small density curve with the sampled draw marked. Plain SVG, server rendered. */
export function BetaCurve({ posterior }: { posterior: Sampled }) {
  const points = betaCurve(posterior, 48);
  const peak = Math.max(...points.map((p) => p.y), 1e-9);
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${(p.x * W).toFixed(1)},${(H - (p.y / peak) * (H - 4)).toFixed(1)}`).join(" ");
  const x = (posterior.sampled * W).toFixed(1);
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Beta(${posterior.alpha}, ${posterior.beta}); sampled ${(posterior.sampled * 100).toFixed(0)}%`}>
      <path d={`${path} L${W},${H} L0,${H} Z`} fill="var(--live)" fillOpacity="0.15" />
      <path d={path} fill="none" stroke="var(--live)" strokeWidth="1.5" />
      <line x1={x} x2={x} y1="0" y2={H} stroke="var(--accent)" strokeWidth="1.5" />
    </svg>
  );
}
