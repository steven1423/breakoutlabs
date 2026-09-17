/**
 * The loop (CLAUDE.md §14): Test → Blueprint → Track → Retest → Data → Growth → Test.
 * Seven arcs on one ring that draw themselves once on the landing page, then the thesis appears.
 * Pure SVG and CSS; under prefers-reduced-motion everything is simply there.
 */
export const LOOP_STAGES = ["Test", "Blueprint", "Track", "Retest", "Data", "Growth"] as const;

const SIZE = 320;
const R = 128;
const C = SIZE / 2;
const GAP_DEG = 9;

function point(angleDeg: number, radius = R): [number, number] {
  const a = ((angleDeg - 90) * Math.PI) / 180;
  return [C + radius * Math.cos(a), C + radius * Math.sin(a)];
}

function arcPath(startDeg: number, endDeg: number): string {
  const [x1, y1] = point(startDeg);
  const [x2, y2] = point(endDeg);
  return `M${x1.toFixed(2)},${y1.toFixed(2)} A${R},${R} 0 0 1 ${x2.toFixed(2)},${y2.toFixed(2)}`;
}

export function Loop({ animate = true }: { animate?: boolean }) {
  const step = 360 / LOOP_STAGES.length;
  const arcLength = ((step - GAP_DEG) / 360) * 2 * Math.PI * R;
  return (
    <svg
      width={SIZE}
      height={SIZE}
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      role="img"
      aria-label="The loop: test, blueprint, track, retest, data, growth, and back to test"
      className={`loop ${animate ? "loop-animate" : ""}`}
    >
      {LOOP_STAGES.map((stage, i) => {
        const start = i * step + GAP_DEG / 2;
        const end = (i + 1) * step - GAP_DEG / 2;
        const [lx, ly] = point(i * step + step / 2, R + 26);
        return (
          <g key={stage} className="loop-stage" style={{ ["--i" as string]: i }}>
            <path d={arcPath(start, end)} fill="none" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" className="loop-arc" style={{ strokeDasharray: arcLength, strokeDashoffset: animate ? arcLength : 0 }} />
            <text x={lx} y={ly} textAnchor="middle" dominantBaseline="middle" fontSize="15" fill="var(--text)" className="loop-label">{stage}</text>
          </g>
        );
      })}
      <circle cx={C} cy={C - R} r="7" fill="var(--accent)" className="loop-spot" />
    </svg>
  );
}
