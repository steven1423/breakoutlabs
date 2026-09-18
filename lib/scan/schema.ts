import { z } from "zod";
import { ANGLES, ZONES } from "./summarize.ts";

/**
 * What the browser is allowed to send after a scan: per-frame metadata and the consent time.
 * No pixels, no descriptors: the shape makes an image impossible to submit, not merely discouraged.
 */
export const frameSchema = z.object({
  angle: z.enum(ANGLES),
  yaw: z.number().min(-90).max(90),
  pitch: z.number().min(-90).max(90),
  faceConfidence: z.number().min(0).max(1),
  real: z.number().min(0).max(1).nullable(),
  cropPx: z.number().int().min(64).max(4096),
  lesions: z.array(z.object({ zone: z.enum(ZONES), score: z.number().min(0).max(1) })).max(500),
  takenAt: z.string().datetime({ offset: true }),
});

export const scanSubmissionSchema = z.object({
  subjectType: z.enum(["creator", "customer"]),
  subjectId: z.uuid(),
  consentedAt: z.string().datetime({ offset: true }),
  model: z.string().min(1).max(120),
  frames: z.array(frameSchema).min(1).max(12),
});

export type ScanSubmission = z.infer<typeof scanSubmissionSchema>;
