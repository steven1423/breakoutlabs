import { NextResponse } from "next/server";
import { enrichInstagramBatch } from "@/lib/creators/discover";

export const maxDuration = 60;

/** Cron entry point for the Instagram enrichment queue. Requires `Authorization: Bearer <CRON_SECRET>`. */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "Not configured: CRON_SECRET" }, { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    return NextResponse.json(await enrichInstagramBatch(20));
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Enrichment failed" }, { status: 500 });
  }
}
