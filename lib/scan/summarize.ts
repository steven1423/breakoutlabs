/**
 * The skin scan's arithmetic, kept pure so it is testable without a browser or a model.
 * Frames come from the viewer's own device; only what this file returns is ever persisted.
 * The detector is a proxy for lesion count (held-out mAP50 0.33), never a diagnosis, and the
 * severity band below is a coarse label on that proxy, not a clinical grade.
 */

export const ZONES = ["forehead", "nose", "rightCheek", "leftCheek", "chin"] as const;
export type Zone = (typeof ZONES)[number];
export const ZONE_LABEL: Record<Zone, string> = { forehead: "Forehead", nose: "Nose", rightCheek: "Right cheek", leftCheek: "Left cheek", chin: "Chin and jaw" };

export const ANGLES = ["front", "left", "right"] as const;
export type Angle = (typeof ANGLES)[number];

export type Lesion = { zone: Zone; score: number };

/** One captured frame after the face pass and the detector pass. Pixels never leave the browser; this is what is kept. */
export type FrameResult = {
  angle: Angle;
  /** Head yaw and pitch in degrees at capture, from the face mesh. */
  yaw: number;
  pitch: number;
  faceConfidence: number;
  /** Advisory anti-spoof score, 0 to 1; low in dim rooms even for real faces. */
  real: number | null;
  /** Side of the square face crop the detector saw, in source pixels. */
  cropPx: number;
  lesions: Lesion[];
  takenAt: string;
};

export type ZoneCount = { zone: Zone; label: string; count: number; frames: number };

export type SeverityBand = "clear" | "mild" | "moderate" | "marked";

export type ScanSummary = {
  frames: number;
  angles: Angle[];
  /** Mean lesions per frame, the number a person can compare with their next scan. */
  lesionsPerFrame: number;
  /** The most any single frame showed. */
  lesionsMax: number;
  perZone: ZoneCount[];
  band: SeverityBand;
  meanScore: number | null;
  /** True when a frame's face crop was smaller than the detector was measured on. */
  lowResolution: boolean;
  /** True when the anti-spoof score was low on any frame; advisory only. */
  spoofFlag: boolean;
};

/** Bands on mean lesions per frame. Coarse on purpose: the detector finds a third to four in ten of real lesions. */
export const BAND_EDGES: { band: SeverityBand; upTo: number }[] = [
  { band: "clear", upTo: 3 },
  { band: "mild", upTo: 10 },
  { band: "moderate", upTo: 25 },
  { band: "marked", upTo: Infinity },
];

export const BAND_LABEL: Record<SeverityBand, string> = { clear: "Clear", mild: "Mild", moderate: "Moderate", marked: "Marked" };

export const MIN_CROP_PX = 480;
export const SPOOF_FLAG_BELOW = 0.5;

export function bandFor(lesionsPerFrame: number): SeverityBand {
  return BAND_EDGES.find((e) => lesionsPerFrame <= e.upTo)!.band;
}

export function summarize(frames: readonly FrameResult[]): ScanSummary | null {
  if (frames.length === 0) return null;
  const counts = frames.map((f) => f.lesions.length);
  const lesionsPerFrame = counts.reduce((a, b) => a + b, 0) / frames.length;
  const perZone: ZoneCount[] = ZONES.map((zone) => {
    const inZone = frames.map((f) => f.lesions.filter((l) => l.zone === zone).length);
    return { zone, label: ZONE_LABEL[zone], count: Math.round((inZone.reduce((a, b) => a + b, 0) / frames.length) * 10) / 10, frames: inZone.filter((n) => n > 0).length };
  });
  const scores = frames.flatMap((f) => f.lesions.map((l) => l.score));
  return {
    frames: frames.length,
    angles: [...new Set(frames.map((f) => f.angle))],
    lesionsPerFrame: Math.round(lesionsPerFrame * 10) / 10,
    lesionsMax: Math.max(...counts),
    perZone,
    band: bandFor(lesionsPerFrame),
    meanScore: scores.length ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 1000) / 1000 : null,
    lowResolution: frames.some((f) => f.cropPx < MIN_CROP_PX),
    spoofFlag: frames.some((f) => f.real !== null && f.real < SPOOF_FLAG_BELOW),
  };
}

/** Which angle a head pose counts as, for the capture gate. Null when the face is not in any target pose. */
export function angleFor(yawDeg: number, pitchDeg: number): Angle | null {
  if (Math.abs(pitchDeg) > 15) return null;
  if (Math.abs(yawDeg) <= 12) return "front";
  if (yawDeg >= 18 && yawDeg <= 40) return "left";
  if (yawDeg <= -18 && yawDeg >= -40) return "right";
  return null;
}
