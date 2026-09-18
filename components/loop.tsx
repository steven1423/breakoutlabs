/**
 * The loop (CLAUDE.md §14): Test → Blueprint → Track → Retest → Data → Growth → Test.
 * Six arcs on one ring that draw themselves once on the landing page, then the thesis appears.
 * The BreakoutLabs wordmark sits in the middle. Pure SVG and CSS; under prefers-reduced-motion everything is simply there.
 */
export const LOOP_STAGES = ["Test", "Blueprint", "Track", "Retest", "Data", "Growth"] as const;

const SIZE = 340;
const R = 138;
const C = SIZE / 2;
const GAP_DEG = 9;
const LABEL_R = R + 18;
/** Labels sit outside the ring; the widest of them overhang it, so the viewBox is padded or they clip. */
const PAD_X = 88;
const PAD_Y = 22;

function point(angleDeg: number, radius = R): [number, number] {
  const a = ((angleDeg - 90) * Math.PI) / 180;
  return [C + radius * Math.cos(a), C + radius * Math.sin(a)];
}

function arcPath(startDeg: number, endDeg: number): string {
  const [x1, y1] = point(startDeg);
  const [x2, y2] = point(endDeg);
  return `M${x1.toFixed(2)},${y1.toFixed(2)} A${R},${R} 0 0 1 ${x2.toFixed(2)},${y2.toFixed(2)}`;
}

/** A label to the right of the ring starts at its anchor, one to the left ends there, one above or below is centred. */
function anchorFor(angleDeg: number): "start" | "middle" | "end" {
  const x = Math.cos(((angleDeg - 90) * Math.PI) / 180);
  if (x > 0.35) return "start";
  if (x < -0.35) return "end";
  return "middle";
}

export function Loop({ animate = true }: { animate?: boolean }) {
  const step = 360 / LOOP_STAGES.length;
  const arcLength = ((step - GAP_DEG) / 360) * 2 * Math.PI * R;
  const logoR = R - 26;
  return (
    <svg
      width={SIZE + 2 * PAD_X}
      height={SIZE + 2 * PAD_Y}
      viewBox={`${-PAD_X} ${-PAD_Y} ${SIZE + 2 * PAD_X} ${SIZE + 2 * PAD_Y}`}
      role="img"
      aria-label="The loop: test, blueprint, track, retest, data, growth, and back to test, around the BreakoutLabs mark"
      className={`loop ${animate ? "loop-animate" : ""}`}
    >
      <defs>
        <clipPath id="loop-logo-clip">
          <circle cx={C} cy={C} r={logoR} />
        </clipPath>
      </defs>
      <circle cx={C} cy={C} r={logoR} fill="#03444c" />
      <image href="/breakoutlabs-logo.png" x={C - logoR} y={C - logoR} width={logoR * 2} height={logoR * 2} clipPath="url(#loop-logo-clip)" preserveAspectRatio="xMidYMid slice" />
      {LOOP_STAGES.map((stage, i) => {
        const start = i * step + GAP_DEG / 2;
        const end = (i + 1) * step - GAP_DEG / 2;
        const mid = i * step + step / 2;
        const [lx, ly] = point(mid, LABEL_R);
        return (
          <g key={stage} className="loop-stage" style={{ ["--i" as string]: i }}>
            <path d={arcPath(start, end)} fill="none" stroke="var(--brand)" strokeWidth="4" strokeLinecap="round" className="loop-arc" style={{ strokeDasharray: arcLength, strokeDashoffset: animate ? arcLength : 0 }} />
            <text
              x={lx}
              y={ly}
              textAnchor={anchorFor(mid)}
              dominantBaseline="middle"
              fontSize="16"
              fontWeight="700"
              fill="var(--text)"
              stroke="var(--bg)"
              strokeWidth="5"
              strokeLinejoin="round"
              paintOrder="stroke"
              className="loop-label"
            >
              {stage}
            </text>
          </g>
        );
      })}
      <circle cx={C} cy={C - R} r="8" fill="var(--lime)" stroke="var(--brand)" strokeWidth="3" className="loop-spot" />
    </svg>
  );
}
