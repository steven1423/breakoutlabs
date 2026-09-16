import { generateDataset, type SyntheticDataset } from "@/lib/synthetic/index";

let cached: SyntheticDataset | null = null;

/** The default dataset, generated once per test run. */
export function dataset(): SyntheticDataset {
  cached ??= generateDataset();
  return cached;
}

export function share<T>(items: readonly T[], predicate: (item: T) => boolean): number {
  return items.filter(predicate).length / items.length;
}

export function expectNear(actual: number, expected: number, tolerance: number, label: string) {
  if (Math.abs(actual - expected) > tolerance) {
    throw new Error(`${label}: expected ${expected} ± ${tolerance}, got ${actual.toFixed(3)}`);
  }
}
