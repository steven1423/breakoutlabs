import { createServiceSupabase, type ServiceClient } from "../db/service.ts";
import type { Database, Json } from "../db/types.ts";
import type { ScanSubmission } from "./schema.ts";
import { summarize, type FrameResult, type ScanSummary, type SeverityBand, type ZoneCount } from "./summarize.ts";

type Row = Database["public"]["Tables"]["skin_scans"]["Row"];

export type SavedScan = {
  id: string;
  subjectType: "creator" | "customer";
  subjectId: string;
  consentedAt: string;
  takenAt: string;
  model: string;
  frames: FrameResult[];
  summary: ScanSummary;
};

/** Recomputes the summary from the frames server-side: the client's arithmetic is never trusted for what is stored. */
export async function saveScan(submission: ScanSubmission, db: ServiceClient = createServiceSupabase()): Promise<SavedScan> {
  const summary = summarize(submission.frames);
  if (!summary) throw new Error("A scan needs at least one frame");
  const { data, error } = await db
    .from("skin_scans")
    .insert({
      subject_type: submission.subjectType,
      subject_id: submission.subjectId,
      consented_at: submission.consentedAt,
      model: submission.model,
      frames: submission.frames as unknown as Json,
      frame_count: summary.frames,
      lesions_per_frame: summary.lesionsPerFrame,
      lesions_max: summary.lesionsMax,
      per_zone: summary.perZone as unknown as Json,
      band: summary.band,
      mean_score: summary.meanScore,
      low_resolution: summary.lowResolution,
      spoof_flag: summary.spoofFlag,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return toSaved(data);
}

/** The newest scan for one subject, or null. */
export async function latestScan(subjectType: "creator" | "customer", subjectId: string, db: ServiceClient = createServiceSupabase()): Promise<SavedScan | null> {
  const { data, error } = await db.from("skin_scans").select("*").eq("subject_type", subjectType).eq("subject_id", subjectId).order("taken_at", { ascending: false }).limit(1).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? toSaved(data) : null;
}

/** The newest scan per creator, for the creators table. */
export async function latestCreatorScans(db: ServiceClient = createServiceSupabase()): Promise<Map<string, SavedScan>> {
  const { data, error } = await db.from("skin_scans").select("*").eq("subject_type", "creator").order("taken_at", { ascending: false });
  if (error) throw new Error(error.message);
  const out = new Map<string, SavedScan>();
  for (const row of data) if (!out.has(row.subject_id)) out.set(row.subject_id, toSaved(row));
  return out;
}

function toSaved(row: Row): SavedScan {
  return {
    id: row.id,
    subjectType: row.subject_type,
    subjectId: row.subject_id,
    consentedAt: row.consented_at,
    takenAt: row.taken_at,
    model: row.model,
    frames: row.frames as unknown as FrameResult[],
    summary: {
      frames: row.frame_count,
      angles: [...new Set((row.frames as unknown as FrameResult[]).map((f) => f.angle))],
      lesionsPerFrame: Number(row.lesions_per_frame),
      lesionsMax: row.lesions_max,
      perZone: row.per_zone as unknown as ZoneCount[],
      band: row.band as SeverityBand,
      meanScore: row.mean_score === null ? null : Number(row.mean_score),
      lowResolution: row.low_resolution,
      spoofFlag: row.spoof_flag,
    },
  };
}
