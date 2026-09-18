/**
 * Face zones as ordered polygons over the 468-point MediaPipe/Human face mesh, ported from the
 * SkinLoop detector bundle. Index convention follows Human: low indices (~100 to 230) are the
 * subject's right side, high indices (~330 to 450) the subject's left. Polygons are approximate.
 */
import { ZONES, type Zone } from "./summarize.ts";

export const ZONE_INDICES: Record<Zone, number[]> = {
  forehead: [21, 54, 103, 67, 109, 10, 338, 297, 332, 284, 251, 301, 300, 293, 334, 296, 336, 9, 107, 66, 105, 63, 70, 71],
  nose: [6, 351, 412, 343, 437, 420, 279, 358, 327, 326, 2, 97, 98, 129, 49, 198, 217, 114, 188, 122],
  rightCheek: [116, 117, 118, 119, 120, 100, 142, 203, 206, 216, 212, 214, 192, 213, 147, 123],
  leftCheek: [345, 346, 347, 348, 349, 329, 371, 423, 426, 436, 432, 434, 416, 433, 376, 352],
  chin: [57, 43, 106, 182, 83, 18, 313, 406, 335, 273, 287, 432, 430, 394, 379, 378, 400, 377, 152, 148, 176, 149, 150, 169, 210, 212],
};

export type Point = [number, number];
export type Polygons = Record<Zone, Point[]>;

/** Pixel-space polygons from a mesh (array of [x, y, z]) with an optional offset and scale into a crop. */
export function zonePolygons(mesh: readonly (readonly number[])[], { offsetX = 0, offsetY = 0, scale = 1 } = {}): Polygons {
  const out = {} as Polygons;
  for (const zone of ZONES) {
    out[zone] = ZONE_INDICES[zone].map((i) => {
      const p = mesh[i] ?? [0, 0];
      return [(p[0] - offsetX) * scale, (p[1] - offsetY) * scale];
    });
  }
  return out;
}

/** Ray-casting point in polygon. */
export function pointInPolygon([x, y]: Point, poly: readonly Point[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    const intersects = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi + 1e-12) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

/** The zone containing a point, or null when it falls on lips, eyes, hair or background. */
export function assignZone(pt: Point, polys: Polygons): Zone | null {
  for (const zone of ZONES) if (pointInPolygon(pt, polys[zone])) return zone;
  return null;
}
