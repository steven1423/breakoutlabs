import { describe, expect, it } from "vitest";
import { angleFor, bandFor, summarize, type FrameResult } from "@/lib/scan/summarize";

const frame = (angle: FrameResult["angle"], lesions: { zone: FrameResult["lesions"][number]["zone"]; score: number }[], extra: Partial<FrameResult> = {}): FrameResult => ({
  angle, yaw: 0, pitch: 0, faceConfidence: 0.9, real: 0.8, cropPx: 640, lesions, takenAt: "2026-09-18T00:00:00Z", ...extra,
});

describe("summarize", () => {
  it("returns null with no frames and averages lesions per frame otherwise", () => {
    expect(summarize([])).toBeNull();
    const s = summarize([frame("front", [{ zone: "chin", score: 0.5 }, { zone: "chin", score: 0.3 }]), frame("left", [{ zone: "leftCheek", score: 0.4 }])])!;
    expect(s.frames).toBe(2);
    expect(s.angles).toEqual(["front", "left"]);
    expect(s.lesionsPerFrame).toBe(1.5);
    expect(s.lesionsMax).toBe(2);
    expect(s.perZone.find((z) => z.zone === "chin")).toEqual({ zone: "chin", label: "Chin and jaw", count: 1, frames: 1 });
    expect(s.meanScore).toBeCloseTo(0.4, 6);
    expect(s.band).toBe("clear");
  });

  it("flags a small crop and a low anti-spoof score", () => {
    const s = summarize([frame("front", [], { cropPx: 300 }), frame("right", [], { real: 0.2 })])!;
    expect(s.lowResolution).toBe(true);
    expect(s.spoofFlag).toBe(true);
    expect(summarize([frame("front", [], { real: null })])!.spoofFlag).toBe(false);
  });
});

describe("bandFor", () => {
  it("bands on mean lesions per frame with inclusive upper edges", () => {
    expect(bandFor(0)).toBe("clear");
    expect(bandFor(3)).toBe("clear");
    expect(bandFor(3.1)).toBe("mild");
    expect(bandFor(10)).toBe("mild");
    expect(bandFor(25)).toBe("moderate");
    expect(bandFor(26)).toBe("marked");
  });
});

describe("angleFor", () => {
  it("names the three capture poses and rejects everything else", () => {
    expect(angleFor(0, 0)).toBe("front");
    expect(angleFor(25, 5)).toBe("left");
    expect(angleFor(-25, -5)).toBe("right");
    expect(angleFor(15, 0)).toBeNull();
    expect(angleFor(50, 0)).toBeNull();
    expect(angleFor(0, 20)).toBeNull();
  });
});
