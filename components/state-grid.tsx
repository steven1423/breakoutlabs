import type { Cell } from "@/lib/intelligence/guard";

/** US states on a tile grid: row, column. A grid keeps every state the same size, which is the honest choice for a count. */
const TILES: Record<string, [number, number]> = {
  AK: [0, 0], ME: [0, 10],
  VT: [1, 9], NH: [1, 10],
  WA: [2, 0], ID: [2, 1], MT: [2, 2], ND: [2, 3], MN: [2, 4], IL: [2, 5], WI: [2, 6], MI: [2, 7], NY: [2, 8], RI: [2, 9], MA: [2, 10],
  OR: [3, 0], NV: [3, 1], WY: [3, 2], SD: [3, 3], IA: [3, 4], IN: [3, 5], OH: [3, 6], PA: [3, 7], NJ: [3, 8], CT: [3, 9],
  CA: [4, 0], UT: [4, 1], CO: [4, 2], NE: [4, 3], MO: [4, 4], KY: [4, 5], WV: [4, 6], VA: [4, 7], MD: [4, 8], DE: [4, 9],
  AZ: [5, 1], NM: [5, 2], KS: [5, 3], AR: [5, 4], TN: [5, 5], NC: [5, 6], SC: [5, 7],
  OK: [6, 3], LA: [6, 4], MS: [6, 5], AL: [6, 6], GA: [6, 7],
  HI: [7, 0], TX: [7, 3], FL: [7, 8],
};

/**
 * Prevalence map (CLAUDE.md §9): the leading root-cause segment per state and its share.
 * Suppressed states are hatched "insufficient data"; states with no consenting customers are dimmed.
 */
export function StateGrid({ cells }: { cells: Cell[] }) {
  const byState = new Map(cells.map((c) => [c.dims.region_state, c]));
  const maxShare = Math.max(0.01, ...cells.map((c) => (c.suppressed ? 0 : c.value ?? 0)));
  return (
    <div className="mt-4 overflow-auto">
      <div className="grid gap-1" style={{ gridTemplateColumns: "repeat(11, minmax(3.6rem, 1fr))", gridTemplateRows: "repeat(8, 3.6rem)", minWidth: "42rem" }} role="list" aria-label="Leading segment by state">
        {Object.entries(TILES).map(([state, [row, col]]) => {
          const cell = byState.get(state);
          const style: React.CSSProperties = { gridRow: row + 1, gridColumn: col + 1 };
          if (!cell) {
            return (
              <div key={state} role="listitem" style={style} className="flex flex-col rounded-control border border-line px-1.5 py-1 text-13 text-muted opacity-50" title={`${state}: no consenting customers`}>
                <span>{state}</span>
              </div>
            );
          }
          if (cell.suppressed) {
            return (
              <div key={state} role="listitem" style={style} className="hatched flex flex-col rounded-control border border-line px-1.5 py-1 text-13" title={`${state}: insufficient data (below the minimum cohort)`}>
                <span>{state}</span>
                <span className="text-muted">n/a</span>
              </div>
            );
          }
          const share = cell.value ?? 0;
          const alpha = 0.15 + 0.6 * (share / maxShare);
          return (
            <div
              key={state}
              role="listitem"
              style={{ ...style, background: `color-mix(in oklab, var(--live) ${Math.round(alpha * 100)}%, var(--surface))` }}
              className="flex flex-col rounded-control border border-line px-1.5 py-1 text-13"
              title={`${state}: ${cell.label} ${Math.round(share * 100)}% of ${cell.count} consenting customers`}
            >
              <span>{state}</span>
              <span className="truncate">{cell.label}</span>
              <span className="text-muted">{Math.round(share * 100)}%, n {cell.count}</span>
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-13 text-muted">Tile colour is the share of the leading segment; hatched tiles are below the minimum cohort; dim tiles have no consenting customers.</p>
    </div>
  );
}
