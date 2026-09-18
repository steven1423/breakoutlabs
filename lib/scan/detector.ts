/**
 * The lesion detector's pre- and post-processing, ported from the SkinLoop bundle so it is typed
 * and testable: letterbox a crop into the model's square input, decode the YOLOv8 output, run NMS,
 * map boxes back to crop pixels and keep only those inside a face zone. Running the model itself
 * is the caller's job (onnxruntime-web in the browser), so nothing here touches a runtime.
 */
import type { Lesion } from "./summarize.ts";
import { assignZone, type Polygons } from "./zones.ts";

export type DetectorConfig = { model: string; inputSize: number; confThreshold: number; iouThreshold: number; classNames: string[]; trained?: string };

export const DEFAULT_CONFIG: DetectorConfig = { model: "acne-detector-int8.onnx", inputSize: 640, confThreshold: 0.16, iouThreshold: 0.45, classNames: ["lesion"] };

/** Merge a detector.json manifest over the defaults; unknown or out-of-range fields are ignored. */
export function resolveConfig(manifest: unknown, base: DetectorConfig = DEFAULT_CONFIG): DetectorConfig {
  const cfg = { ...base };
  if (!manifest || typeof manifest !== "object") return cfg;
  const m = manifest as Record<string, unknown>;
  if (typeof m.model === "string" && /^[\w.-]+\.onnx$/.test(m.model)) cfg.model = m.model;
  if (Number.isInteger(m.inputSize) && (m.inputSize as number) >= 160 && (m.inputSize as number) <= 1280 && (m.inputSize as number) % 32 === 0) cfg.inputSize = m.inputSize as number;
  if (typeof m.confThreshold === "number" && m.confThreshold > 0 && m.confThreshold < 1) cfg.confThreshold = m.confThreshold;
  if (typeof m.iouThreshold === "number" && m.iouThreshold > 0 && m.iouThreshold < 1) cfg.iouThreshold = m.iouThreshold;
  if (Array.isArray(m.classNames) && m.classNames.length && m.classNames.every((c) => typeof c === "string")) cfg.classNames = m.classNames as string[];
  if (typeof m.trained === "string") cfg.trained = m.trained;
  return cfg;
}

export type Letterbox = { tensor: Float32Array; scale: number; padX: number; padY: number };

/** Letterbox RGBA pixels into a square float32 NCHW tensor in 0 to 1, padded with the 114/255 grey the model was trained with. */
export function letterbox(pixels: { width: number; height: number; data: Uint8ClampedArray | Uint8Array }, size: number): Letterbox {
  const { width: w, height: h, data } = pixels;
  const scale = Math.min(size / w, size / h);
  const nw = Math.round(w * scale);
  const nh = Math.round(h * scale);
  const padX = Math.floor((size - nw) / 2);
  const padY = Math.floor((size - nh) / 2);
  const out = new Float32Array(3 * size * size).fill(114 / 255);
  const plane = size * size;
  for (let y = 0; y < nh; y++) {
    const sy = Math.min(h - 1, Math.floor(y / scale));
    for (let x = 0; x < nw; x++) {
      const sx = Math.min(w - 1, Math.floor(x / scale));
      const si = (sy * w + sx) * 4;
      const di = (y + padY) * size + (x + padX);
      out[di] = data[si] / 255;
      out[plane + di] = data[si + 1] / 255;
      out[2 * plane + di] = data[si + 2] / 255;
    }
  }
  return { tensor: out, scale, padX, padY };
}

export type Box = { x1: number; y1: number; x2: number; y2: number; score: number; cls: number };

function iou(a: Box, b: Box): number {
  const x1 = Math.max(a.x1, b.x1);
  const y1 = Math.max(a.y1, b.y1);
  const x2 = Math.min(a.x2, b.x2);
  const y2 = Math.min(a.y2, b.y2);
  const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  const union = (a.x2 - a.x1) * (a.y2 - a.y1) + (b.x2 - b.x1) * (b.y2 - b.y1) - inter;
  return union > 0 ? inter / union : 0;
}

export function nms(boxes: readonly Box[], iouThreshold: number): Box[] {
  const sorted = [...boxes].sort((p, q) => q.score - p.score);
  const keep: Box[] = [];
  for (const b of sorted) if (keep.every((k) => k.cls !== b.cls || iou(k, b) < iouThreshold)) keep.push(b);
  return keep;
}

/** Decode the raw YOLOv8 output, shape [1, 4+nc, N] (the default export) or [1, N, 4+nc], into letterboxed-pixel boxes. */
export function decodeYolo(output: ArrayLike<number>, dims: readonly number[], confThreshold: number, numClasses: number): Box[] {
  const boxes: Box[] = [];
  const [, d1, d2] = dims;
  const channelsFirst = d1 === 4 + numClasses;
  const N = channelsFirst ? d2 : d1;
  const C = 4 + numClasses;
  const get = channelsFirst ? (c: number, i: number) => output[c * N + i] : (c: number, i: number) => output[i * C + c];
  for (let i = 0; i < N; i++) {
    let best = 0;
    let cls = 0;
    for (let k = 0; k < numClasses; k++) {
      const s = get(4 + k, i);
      if (s > best) {
        best = s;
        cls = k;
      }
    }
    if (best < confThreshold) continue;
    const cx = get(0, i);
    const cy = get(1, i);
    const w = get(2, i);
    const h = get(3, i);
    boxes.push({ x1: cx - w / 2, y1: cy - h / 2, x2: cx + w / 2, y2: cy + h / 2, score: best, cls });
  }
  return boxes;
}

export type LesionBox = Lesion & { x: number; y: number; r: number };

/**
 * Map letterboxed boxes back to crop pixels and keep only those inside a face zone, so lips, eyes,
 * hair and background never count and the zone table adds up to the total.
 */
export function boxesToLesions(kept: readonly Box[], lb: Pick<Letterbox, "scale" | "padX" | "padY">, polys: Polygons): LesionBox[] {
  const out: LesionBox[] = [];
  for (const b of kept) {
    const x1 = (b.x1 - lb.padX) / lb.scale;
    const y1 = (b.y1 - lb.padY) / lb.scale;
    const x2 = (b.x2 - lb.padX) / lb.scale;
    const y2 = (b.y2 - lb.padY) / lb.scale;
    const cx = (x1 + x2) / 2;
    const cy = (y1 + y2) / 2;
    const zone = assignZone([cx, cy], polys);
    if (!zone) continue;
    out.push({ x: cx, y: cy, r: Math.max(x2 - x1, y2 - y1) / 2, score: Math.round(b.score * 1000) / 1000, zone });
  }
  return out;
}
