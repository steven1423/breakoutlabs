import type { Cell } from "@/lib/intelligence/guard";

const AGE_BANDS = ["16-19", "20-24", "25-34", "35-44", "45+"];
const SEGMENTS = ["androgen", "insulin", "cortisol", "nutrient", "inflammation", "mixed"];
/** Six fixed hues in a fixed order (validated in globals.css), never reassigned when a band is missing a segment. */
const HUES: Record<string, string> = { androgen: "var(--seg-1)", insulin: "var(--seg-2)", cortisol: "var(--seg-3)", nutrient: "var(--seg-4)", inflammation: "var(--seg-5)", mixed: "var(--seg-6)" };

/**
 * Segment mix per age band as 100% stacked bars, from the same guarded cells as the coverage
 * heatmap. Suppressed cells are hatched at their unknown width: the band still sums to 100%
 * because the guard reports the band total.
 */
export function SegmentMixChart({ cells }: { cells: Cell[] }) {
  const byBand = new Map<string, Cell[]>();
  for (const c of cells) byBand.set(c.dims.age_band, [...(byBand.get(c.dims.age_band) ?? []), c]);
  return (
    <div className="mt-2 flex flex-col gap-3">
      {AGE_BANDS.map((band) => {
        const rows = byBand.get(band) ?? [];
        const known = rows.reduce((a, c) => a + (c.suppressed ? 0 : c.count), 0);
        const suppressed = rows.filter((c) => c.suppressed).length;
        // A suppressed cell is under the minimum; draw it as if it were just under so the bar reads honestly small.
        const total = known + suppressed * 1;
        return (
          <div key={band} className="grid grid-cols-[4rem_minmax(0,1fr)_5rem] items-center gap-3 text-13">
            <span className="text-muted">{band}</span>
            <div className="flex h-5 w-full overflow-hidden rounded-control bg-raised" role="img" aria-label={`${band}: ${rows.map((c) => (c.suppressed ? `${c.dims.segment} suppressed` : `${c.dims.segment} ${c.count}`)).join(", ")}`}>
              {SEGMENTS.map((s) => {
                const cell = rows.find((c) => c.dims.segment === s);
                if (!cell) return null;
                const width = total ? `${((cell.suppressed ? 1 : cell.count) / total) * 100}%` : "0%";
                return cell.suppressed
                  ? <span key={s} className="hatched border-r-2 border-surface" style={{ width }} title={`${s}: below the minimum cohort`} />
                  : <span key={s} className="border-r-2 border-surface last:border-r-0" style={{ width, background: HUES[s] }} title={`${s}: ${cell.count} (${Math.round((cell.count / total) * 100)}%)`} />;
              })}
            </div>
            <span className="text-right text-muted">n {known}{suppressed ? ` +${suppressed} hidden` : ""}</span>
          </div>
        );
      })}
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-13 text-muted">
        {SEGMENTS.map((s) => (
          <li key={s} className="flex items-center gap-1.5"><span aria-hidden="true" className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: HUES[s] }} />{s}</li>
        ))}
        <li className="flex items-center gap-1.5"><span aria-hidden="true" className="hatched inline-block h-2.5 w-2.5 rounded-sm" />below minimum cohort</li>
      </ul>
    </div>
  );
}
