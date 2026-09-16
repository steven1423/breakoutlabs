import { NextResponse } from "next/server";
import { sweepStuckKits } from "@/lib/state-machine/db";

/**
 * Cron entry point for the stuck-kit sweep. Requires `Authorization: Bearer <CRON_SECRET>`.
 * With no CRON_SECRET configured the route refuses, so an unprotected deploy cannot be swept from outside.
 */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "Not configured: CRON_SECRET" }, { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    return NextResponse.json(await sweepStuckKits());
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Sweep failed" }, { status: 500 });
  }
}

export const GET = POST;
