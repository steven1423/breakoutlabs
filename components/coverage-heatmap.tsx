import type { Cell } from "@/lib/intelligence/guard";

const AGE_BANDS = ["16-19", "20-24", "25-34", "35-44", "45+"];
const SEGMENTS = ["androgen", "insulin", "cortisol", "nutrient", "inflammation", "mixed"];

/** Coverage (CLAUDE.md §9): consenting customers per segment × age band. Where the dataset is thin, recruit there. */
export function CoverageHeatmap({ cells, region }: { cells: Cell[]; region: string | null }) {
  const key = (s: string, a: string) => `${s}|${a}`;
  const byKey = new Map(cells.map((c) => [key(c.dims.segment, c.dims.age_band), c]));
  const max = Math.max(1, ...cells.map((c) => (c.suppressed ? 0 : c.count)));
  return (
    <div className="mt-4 overflow-auto rounded-panel border border-line">
      <table className="w-full text-15">
        <thead className="bg-surface text-left text-13 text-muted">
          <tr>
            <th className="px-3 py-2 font-medium">Segment{region ? ` in ${region}` : ""}</th>
            {AGE_BANDS.map((a) => <th key={a} className="px-3 py-2 text-right font-medium">{a}</th>)}
          </tr>
        </thead>
        <tbody>
          {SEGMENTS.map((s) => (
            <tr key={s} className="border-t border-line">
              <td className="px-3 py-2">{s}</td>
              {AGE_BANDS.map((a) => {
                const cell = byKey.get(key(s, a));
                if (!cell) return <td key={a} className="px-3 py-2 text-right text-muted opacity-50">0</td>;
                if (cell.suppressed) return <td key={a} className="hatched px-3 py-2 text-right text-muted" title="Below the minimum cohort">n/a</td>;
                const alpha = 0.1 + 0.6 * (cell.count / max);
                return (
                  <td key={a} className="px-3 py-2 text-right" style={{ background: `color-mix(in oklab, var(--live) ${Math.round(alpha * 100)}%, var(--surface))` }}>
                    {cell.count}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
