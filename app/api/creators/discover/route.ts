import { NextResponse } from "next/server";
import { runDiscovery } from "@/lib/creators/discover";

export const maxDuration = 60;

/** Cron entry point for YouTube discovery. Requires `Authorization: Bearer <CRON_SECRET>`; refuses when unset. */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "Not configured: CRON_SECRET" }, { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    return NextResponse.json(await runDiscovery(40));
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Discovery failed" }, { status: 500 });
  }
}
