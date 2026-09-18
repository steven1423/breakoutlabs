import { describe, expect, it } from "vitest";
import { boxesToLesions, decodeYolo, letterbox, nms, resolveConfig, type Box } from "@/lib/scan/detector";
import { assignZone, pointInPolygon, zonePolygons, type Polygons } from "@/lib/scan/zones";

describe("letterbox", () => {
  it("keeps the aspect ratio, pads with the training grey and writes channels first", () => {
    const w = 4;
    const h = 2;
    const data = new Uint8ClampedArray(w * h * 4).fill(255); // white
    const lb = letterbox({ width: w, height: h, data }, 8);
    expect(lb.scale).toBe(2);
    expect([lb.padX, lb.padY]).toEqual([0, 2]);
    const plane = 64;
    expect(lb.tensor[0]).toBeCloseTo(114 / 255, 6); // padding row
    expect(lb.tensor[2 * 8]).toBe(1); // first image row, red plane
    expect(lb.tensor[plane + 2 * 8]).toBe(1); // green plane
    expect(lb.tensor.length).toBe(3 * plane);
  });
});

describe("decodeYolo and nms", () => {
  it("reads the channels-first export, thresholds, and suppresses overlapping boxes", () => {
    // 3 candidates, layout [1, 5, 3]: rows cx, cy, w, h, score. The first two overlap at IoU 0.62; the third is below threshold.
    const out = [10, 11, 50, /* cx */ 10, 11, 50, /* cy */ 8, 8, 8, /* w */ 8, 8, 8, /* h */ 0.9, 0.5, 0.1];
    const boxes = decodeYolo(out, [1, 5, 3], 0.16, 1);
    expect(boxes.length).toBe(2);
    const kept = nms(boxes, 0.45);
    expect(kept.length).toBe(1);
    expect(kept[0].score).toBe(0.9);
  });

  it("also reads the transposed layout", () => {
    const out = [10, 10, 8, 8, 0.7];
    expect(decodeYolo(out, [1, 1, 5], 0.16, 1)[0]).toMatchObject({ x1: 6, y1: 6, x2: 14, y2: 14, score: 0.7 });
  });
});

describe("zones", () => {
  const square: Polygons = { forehead: [[0, 0], [10, 0], [10, 10], [0, 10]], nose: [], rightCheek: [], leftCheek: [], chin: [] };

  it("assigns a point to the first zone that contains it and null outside every zone", () => {
    expect(pointInPolygon([5, 5], square.forehead)).toBe(true);
    expect(assignZone([5, 5], square)).toBe("forehead");
    expect(assignZone([50, 50], square)).toBeNull();
  });

  it("builds polygons from a mesh with an offset and scale", () => {
    const mesh = Array.from({ length: 468 }, (_, i) => [i, i * 2, 0]);
    const polys = zonePolygons(mesh, { offsetX: 1, offsetY: 2, scale: 0.5 });
    expect(polys.nose[0]).toEqual([(6 - 1) * 0.5, (12 - 2) * 0.5]);
  });

  it("drops detections outside the zones when mapping back to crop pixels", () => {
    const boxes: Box[] = [
      { x1: 2, y1: 2, x2: 6, y2: 6, score: 0.8, cls: 0 },
      { x1: 40, y1: 40, x2: 44, y2: 44, score: 0.8, cls: 0 },
    ];
    const lesions = boxesToLesions(boxes, { scale: 1, padX: 0, padY: 0 }, square);
    expect(lesions.length).toBe(1);
    expect(lesions[0]).toMatchObject({ zone: "forehead", x: 4, y: 4, r: 2, score: 0.8 });
  });
});

describe("resolveConfig", () => {
  it("accepts a sane manifest and ignores a bad one", () => {
    expect(resolveConfig({ model: "x.onnx", inputSize: 480, confThreshold: 0.2 })).toMatchObject({ model: "x.onnx", inputSize: 480, confThreshold: 0.2, iouThreshold: 0.45 });
    expect(resolveConfig({ model: "../evil", inputSize: 100, confThreshold: 2 })).toMatchObject({ model: "acne-detector-int8.onnx", inputSize: 640, confThreshold: 0.16 });
    expect(resolveConfig(null).inputSize).toBe(640);
  });
});
