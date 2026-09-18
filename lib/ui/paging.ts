/** Server-side paging for the long lists. Pure so it is testable; the page number lives in the URL. */

export const PAGE_SIZE = 25;

export type Page<T> = { rows: T[]; page: number; pages: number; total: number; from: number; to: number; size: number };

/** Page `page` (1-based) of `rows`. An out-of-range page clamps rather than returning nothing. */
export function pageOf<T>(rows: readonly T[], page: number, size = PAGE_SIZE): Page<T> {
  const total = rows.length;
  const pages = Math.max(1, Math.ceil(total / size));
  const current = Math.min(pages, Math.max(1, Math.floor(page) || 1));
  const start = (current - 1) * size;
  const slice = rows.slice(start, start + size);
  return { rows: slice, page: current, pages, total, from: total === 0 ? 0 : start + 1, to: start + slice.length, size };
}

/** Reads a page number out of a query value; anything unusable is page 1. */
export function parsePage(value: string | string[] | undefined): number {
  const raw = Array.isArray(value) ? value[0] : value;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 1 ? n : 1;
}

/** Builds a query string from the current params with some keys replaced; empty values drop the key. */
export function withParams(current: Record<string, string | string[] | undefined>, patch: Record<string, string | number | null>): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(current)) {
    const single = Array.isArray(v) ? v[0] : v;
    if (single !== undefined && single !== "") params.set(k, single);
  }
  for (const [k, v] of Object.entries(patch)) {
    if (v === null || v === "") params.delete(k);
    else params.set(k, String(v));
  }
  const s = params.toString();
  return s ? `?${s}` : "";
}
