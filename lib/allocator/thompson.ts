/**
 * Thompson sampling over retest-per-order (CLAUDE.md §8.8).
 * One Beta(α, β) per campaign; sample θ, allocate budget ∝ θ with a 5% floor and 40% cap.
 * Pure: the caller supplies the random source, so tests and weekly runs are reproducible.
 */

export type Uniform = () => number;

export type Evidence = { campaignId: string; orders: number; retested: number };
export type Posterior = { alpha: number; beta: number };
export type Sampled = Posterior & { sampled: number };

export const FLOOR = 0.05;
export const CAP = 0.4;

/** Beta(1 + retested, 1 + orders − retested): the uniform prior updated by what the campaign has shown. */
export function posteriorFor(e: Evidence): Posterior {
  const retested = Math.max(0, Math.min(e.retested, e.orders));
  return { alpha: 1 + retested, beta: 1 + Math.max(0, e.orders) - retested };
}

export function posteriorMean(p: Posterior): number {
  return p.alpha / (p.alpha + p.beta);
}

/** Beta draw as a ratio of two Gamma draws (Marsaglia and Tsang). */
export function sampleBeta(uniform: Uniform, alpha: number, beta: number): number {
  const x = sampleGamma(uniform, alpha);
  const y = sampleGamma(uniform, beta);
  return x + y === 0 ? 0.5 : x / (x + y);
}

function sampleGamma(uniform: Uniform, shape: number): number {
  if (shape < 1) return sampleGamma(uniform, shape + 1) * Math.pow(nonZero(uniform()), 1 / shape);
  const d = shape - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);
  for (;;) {
    const z = normal(uniform);
    const v = Math.pow(1 + c * z, 3);
    if (v <= 0) continue;
    const u = nonZero(uniform());
    if (Math.log(u) < 0.5 * z * z + d - d * v + d * Math.log(v)) return d * v;
  }
}

function normal(uniform: Uniform): number {
  const u1 = nonZero(uniform());
  const u2 = uniform();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

function nonZero(u: number): number {
  return u <= 0 ? Number.EPSILON : u;
}

export type Allocation = { posterior: Record<string, Sampled>; allocation: Record<string, number> };

/**
 * Shares ∝ sampled θ, then clamped to [floor, cap] with the remainder spread over the unclamped
 * campaigns until nothing moves. Amounts are whole cents that sum to the budget exactly.
 */
export function allocate(budgetUsd: number, evidence: Evidence[], uniform: Uniform, floor = FLOOR, cap = CAP): Allocation {
  const ids = evidence.map((e) => e.campaignId);
  const posterior: Record<string, Sampled> = {};
  for (const e of evidence) {
    const p = posteriorFor(e);
    posterior[e.campaignId] = { ...p, sampled: sampleBeta(uniform, p.alpha, p.beta) };
  }
  const shares = clampShares(ids.map((id) => posterior[id].sampled), floor, cap);
  const cents = toCents(budgetUsd, shares);
  const allocation: Record<string, number> = {};
  ids.forEach((id, i) => { allocation[id] = cents[i] / 100; });
  return { posterior, allocation };
}

export function clampShares(weights: number[], floor: number, cap: number): number[] {
  const n = weights.length;
  if (n === 0) return [];
  if (floor * n > 1 || cap * n < 1) throw new Error(`Floor ${floor} and cap ${cap} cannot both hold for ${n} campaigns`);
  const total = weights.reduce((a, b) => a + b, 0);
  let shares = weights.map((w) => (total > 0 ? w / total : 1 / n));
  // Water-filling: clamp, then hand the shortfall (or surplus) to campaigns with headroom, in proportion to it.
  for (let iteration = 0; iteration < 50; iteration++) {
    shares = shares.map((s) => Math.min(cap, Math.max(floor, s)));
    const excess = 1 - shares.reduce((a, b) => a + b, 0);
    if (Math.abs(excess) < 1e-12) break;
    const room = shares.map((s) => (excess > 0 ? cap - s : s - floor));
    const roomTotal = room.reduce((a, b) => a + b, 0);
    if (roomTotal <= 0) break;
    shares = shares.map((s, i) => s + (excess * room[i]) / roomTotal);
  }
  return shares;
}

/** Whole cents that sum exactly to the budget; leftover cents go one each to the largest remainders. */
function toCents(budgetUsd: number, shares: number[]): number[] {
  const budgetCents = Math.round(budgetUsd * 100);
  const exact = shares.map((s) => s * budgetCents);
  const cents = exact.map((c) => Math.floor(c));
  let residual = budgetCents - cents.reduce((a, b) => a + b, 0);
  const byRemainder = exact.map((c, i) => [c - cents[i], i] as const).sort((a, b) => b[0] - a[0]);
  for (const [, i] of byRemainder) {
    if (residual <= 0) break;
    cents[i]++;
    residual--;
  }
  return cents;
}

/** Points on the Beta density for a small curve. */
export function betaCurve(p: Posterior, points = 40): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  for (let i = 1; i < points; i++) {
    const x = i / points;
    out.push({ x, y: betaPdf(x, p.alpha, p.beta) });
  }
  return out;
}

export function betaPdf(x: number, alpha: number, beta: number): number {
  if (x <= 0 || x >= 1) return 0;
  const logB = logGamma(alpha) + logGamma(beta) - logGamma(alpha + beta);
  return Math.exp((alpha - 1) * Math.log(x) + (beta - 1) * Math.log(1 - x) - logB);
}

/** Lanczos approximation. */
function logGamma(z: number): number {
  const g = 7;
  const c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
  if (z < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * z)) - logGamma(1 - z);
  z -= 1;
  let x = c[0];
  for (let i = 1; i < g + 2; i++) x += c[i] / (z + i);
  const t = z + g + 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
}

/**
 * Central credible interval of a Beta posterior, by numeric integration of the density on a fine
 * grid. Good to about a tenth of a point, which is all a chart label needs.
 */
export function betaInterval(p: Posterior, mass = 0.9, steps = 2000): [number, number] {
  const tail = (1 - mass) / 2;
  const cdf: number[] = [0];
  let total = 0;
  for (let i = 1; i < steps; i++) {
    const a = betaPdf((i - 0.5) / steps, p.alpha, p.beta);
    total += a / steps;
    cdf.push(total);
  }
  const at = (q: number): number => {
    const target = q * total;
    const i = cdf.findIndex((c) => c >= target);
    return Math.min(1, Math.max(0, (i < 0 ? steps : i) / steps));
  };
  return [at(tail), at(1 - tail)];
}
