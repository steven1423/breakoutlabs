import seedrandom from "seedrandom";

/**
 * Deterministic random source for the seed generator (CLAUDE.md §12).
 * Everything in the dataset, ids and timestamps included, derives from this stream,
 * so the same seed string always produces byte-identical data.
 */
export class Rng {
  private readonly prng: seedrandom.PRNG;

  constructor(seed: string) {
    this.prng = seedrandom(seed);
  }

  /** Uniform in [0, 1). */
  next(): number {
    return this.prng();
  }

  chance(probability: number): boolean {
    return this.next() < probability;
  }

  /** Integer in [lo, hi], inclusive. */
  int(lo: number, hi: number): number {
    return lo + Math.floor(this.next() * (hi - lo + 1));
  }

  float(lo: number, hi: number): number {
    return lo + this.next() * (hi - lo);
  }

  pick<T>(items: readonly T[]): T {
    return items[Math.floor(this.next() * items.length)];
  }

  /** Picks by weight. Weights need not sum to 1. */
  weighted<T>(entries: readonly (readonly [T, number])[]): T {
    const total = entries.reduce((sum, [, w]) => sum + w, 0);
    let roll = this.next() * total;
    for (const [item, weight] of entries) {
      roll -= weight;
      if (roll < 0) return item;
    }
    return entries[entries.length - 1][0];
  }

  /** Normal draw via Box-Muller. */
  normal(mean: number, sd: number): number {
    const u1 = 1 - this.next();
    const u2 = this.next();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return mean + z * sd;
  }

  /**
   * Exactly `n` items whose category shares match the weights (largest remainders get the
   * leftover slots), shuffled. Used where §12 states a share we want to hold by construction.
   */
  quotas<T>(entries: readonly (readonly [T, number])[], n: number): T[] {
    const total = entries.reduce((sum, [, w]) => sum + w, 0);
    const exact = entries.map(([item, w]) => ({ item, want: (n * w) / total }));
    const counts = exact.map((e) => Math.floor(e.want));
    let remaining = n - counts.reduce((a, b) => a + b, 0);
    const byRemainder = exact.map((e, i) => [e.want - counts[i], i] as const).sort((a, b) => b[0] - a[0]);
    for (const [, i] of byRemainder) {
      if (remaining === 0) break;
      counts[i]++;
      remaining--;
    }
    const out: T[] = [];
    exact.forEach((e, i) => { for (let k = 0; k < counts[i]; k++) out.push(e.item); });
    return this.shuffle(out);
  }

  /** Fisher-Yates on a copy. */
  shuffle<T>(items: readonly T[]): T[] {
    const out = [...items];
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }

  /** RFC 4122 v4-shaped uuid built from this stream, so ids are reproducible. */
  uuid(): string {
    const bytes = Array.from({ length: 16 }, () => Math.floor(this.next() * 256));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = bytes.map((b) => b.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
}
