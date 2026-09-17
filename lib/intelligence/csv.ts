import type { Cell, Dimension } from "./guard.ts";

/** Guarded cells as CSV. The only columns are dimension values, count, value and label; a row cannot be expressed here. */
export function cellsToCsv(cells: readonly Cell[], dimensions: readonly Dimension[]): string {
  const header = [...dimensions, "count", "value", "label"].join(",");
  const lines = cells.map((c) => {
    const dims = dimensions.map((d) => quote(c.dims[d] ?? ""));
    if (c.suppressed) return [...dims, "suppressed", "suppressed", ""].join(",");
    return [...dims, String(c.count), c.value === null ? "" : String(Number(c.value.toFixed(4))), quote(c.label ?? "")].join(",");
  });
  return [header, ...lines].join("\n") + "\n";
}

function quote(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}
