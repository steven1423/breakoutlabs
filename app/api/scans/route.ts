import { NextResponse } from "next/server";
import { latestScan, saveScan } from "@/lib/scan/db";
import { scanSubmissionSchema } from "@/lib/scan/schema";

export const dynamic = "force-dynamic";

/**
 * Saves a scan summary. The body is per-frame metadata only; the schema cannot express an image,
 * and the summary is recomputed here from the frames rather than taken from the client.
 */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON" }, { status: 400 });
  }
  const parsed = scanSubmissionSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") }, { status: 400 });
  try {
    const saved = await saveScan(parsed.data);
    return NextResponse.json({ scan: saved });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Could not save the scan" }, { status: 500 });
  }
}

/** The newest scan for a subject: GET /api/scans?subject=creator&id=<uuid>. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const subject = url.searchParams.get("subject");
  const id = url.searchParams.get("id") ?? "";
  if ((subject !== "creator" && subject !== "customer") || !/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "subject must be creator or customer and id a uuid" }, { status: 400 });
  try {
    return NextResponse.json({ scan: await latestScan(subject, id) });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Could not load the scan" }, { status: 500 });
  }
}
