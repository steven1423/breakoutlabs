import type { Database } from "../db/types.ts";
import { MARKERS, refRange, type Marker, type Segment, type Sex } from "./constants.ts";
import type { Rng } from "./rng.ts";

export type Flag = Database["public"]["Enums"]["flag"];
export type MarkerValue = { marker: Marker; value: number; unit: string; ref_low: number; ref_high: number; flag: Flag };

type Center = { mean: number; sd: number };
type Centers = { normal: Center; driven: Center };

/** Where values sit when the marker is healthy versus when it is the acne driver. */
function centers(marker: Marker, sex: Sex): Centers {
  const female = sex !== "male";
  switch (marker) {
    case "testosterone":
      return female
        ? { normal: { mean: 38, sd: 12 }, driven: { mean: 88, sd: 14 } }
        : { normal: { mean: 620, sd: 140 }, driven: { mean: 1120, sd: 90 } };
    case "dhea_s": return { normal: { mean: 230, sd: 80 }, driven: { mean: 500, sd: 55 } };
    case "shbg":
      return female
        ? { normal: { mean: 70, sd: 22 }, driven: { mean: 15, sd: 3.5 } }
        : { normal: { mean: 32, sd: 9 }, driven: { mean: 8, sd: 1.5 } };
    case "cortisol": return { normal: { mean: 13, sd: 3.5 }, driven: { mean: 27, sd: 3 } };
    case "insulin": return { normal: { mean: 8, sd: 3 }, driven: { mean: 25, sd: 5 } };
    case "vitamin_d": return { normal: { mean: 48, sd: 12 }, driven: { mean: 19, sd: 5 } };
    case "zinc": return { normal: { mean: 88, sd: 13 }, driven: { mean: 52, sd: 5 } };
    case "hs_crp": return { normal: { mean: 0.9, sd: 0.6 }, driven: { mean: 5.2, sd: 1.4 } };
  }
}

const DRIVERS_BY_SEGMENT: Record<Exclude<Segment, "mixed" | "nutrient">, readonly Marker[]> = {
  androgen: ["testosterone", "dhea_s", "shbg"],
  insulin: ["insulin"],
  cortisol: ["cortisol"],
  inflammation: ["hs_crp"],
};

/** The markers a segment pushes out of range. Nutrient is D and/or zinc; mixed is two segments' drivers. */
export function driversFor(rng: Rng, segment: Segment): Marker[] {
  if (segment === "nutrient") return rng.pick([["vitamin_d"], ["zinc"], ["vitamin_d", "zinc"]] as const).slice();
  if (segment === "mixed") {
    const [a, b] = rng.shuffle(["androgen", "insulin", "cortisol", "inflammation"] as const).slice(0, 2);
    return [...DRIVERS_BY_SEGMENT[a], ...DRIVERS_BY_SEGMENT[b]];
  }
  return [...DRIVERS_BY_SEGMENT[segment]];
}

export function flagFor(marker: Marker, sex: Sex, value: number): Flag {
  const { low, high } = refRange(marker, sex);
  if (value < low) return "low";
  if (value > high) return "high";
  return "optimal";
}

function draw(rng: Rng, marker: Marker, sex: Sex, center: Center): MarkerValue {
  const value = Math.max(0.1, round1(rng.normal(center.mean, center.sd)));
  const range = refRange(marker, sex);
  return { marker, value, unit: range.unit, ref_low: range.low, ref_high: range.high, flag: flagFor(marker, sex, value) };
}

/** A driver draw that is guaranteed out of range on the driven side (§12 segment rules). */
function drawDriven(rng: Rng, marker: Marker, sex: Sex): MarkerValue {
  const c = centers(marker, sex);
  const wantHigh = c.driven.mean > c.normal.mean;
  for (let attempt = 0; attempt < 4; attempt++) {
    const v = draw(rng, marker, sex, c.driven);
    if (v.flag === (wantHigh ? "high" : "low")) return v;
  }
  const { low, high } = refRange(marker, sex);
  const value = round1(wantHigh ? high * 1.1 : Math.max(0.1, low * 0.85));
  return { ...draw(rng, marker, sex, c.driven), value, flag: flagFor(marker, sex, value) };
}

/** Baseline panel: drivers out of range on their driven side, everything else around normal. */
export function baselineValues(rng: Rng, sex: Sex, drivers: readonly Marker[]): MarkerValue[] {
  return MARKERS.map((marker) =>
    drivers.includes(marker) ? drawDriven(rng, marker, sex) : draw(rng, marker, sex, centers(marker, sex).normal),
  );
}

/**
 * Retest panel: each driver moves back to its normal center with probability `improveProb`
 * (60–75% per §12); otherwise it drifts. Non-drivers drift a little either way.
 */
export function retestValues(rng: Rng, sex: Sex, baseline: readonly MarkerValue[], drivers: readonly Marker[], improveProb: number): MarkerValue[] {
  return baseline.map((b) => {
    const isDriver = drivers.includes(b.marker);
    if (isDriver && rng.chance(improveProb)) return draw(rng, b.marker, sex, centers(b.marker, sex).normal);
    const drift = isDriver ? rng.float(-0.12, 0.08) : rng.float(-0.08, 0.08);
    const value = Math.max(0.1, round1(b.value * (1 + drift)));
    return { ...b, value, flag: flagFor(b.marker, sex, value) };
  });
}

/** Drivers that were out of range at baseline and optimal at retest. */
export function countImproved(baseline: readonly MarkerValue[], retest: readonly MarkerValue[], drivers: readonly Marker[]): number {
  return drivers.filter((marker) => {
    const before = baseline.find((m) => m.marker === marker);
    const after = retest.find((m) => m.marker === marker);
    return before?.flag !== "optimal" && after?.flag === "optimal";
  }).length;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
