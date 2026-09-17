/** YouTube search.list is 100 units of a 10,000-unit day; we allow 60 per day (CLAUDE.md §8.2). */

export const DAILY_SEARCH_CALLS = 60;

export type QuotaState = { date: string; search_calls: number };

export function parseQuota(value: unknown): QuotaState {
  if (value && typeof value === "object" && "date" in value && "search_calls" in value) {
    const v = value as { date: unknown; search_calls: unknown };
    if (typeof v.date === "string" && typeof v.search_calls === "number") return { date: v.date, search_calls: v.search_calls };
  }
  return { date: "", search_calls: 0 };
}

/** The UTC calendar date the quota resets on. */
export function quotaDate(now: Date): string {
  return now.toISOString().slice(0, 10);
}

/** Pure step: one more search on `now`. `allowed` is false once the day's calls are spent. */
export function takeSearchCall(state: QuotaState, now: Date, limit = DAILY_SEARCH_CALLS): { state: QuotaState; allowed: boolean } {
  const today = quotaDate(now);
  const current = state.date === today ? state : { date: today, search_calls: 0 };
  if (current.search_calls >= limit) return { state: current, allowed: false };
  return { state: { date: today, search_calls: current.search_calls + 1 }, allowed: true };
}

export function remainingSearchCalls(state: QuotaState, now: Date, limit = DAILY_SEARCH_CALLS): number {
  return state.date === quotaDate(now) ? Math.max(0, limit - state.search_calls) : limit;
}
