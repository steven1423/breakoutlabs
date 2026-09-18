import { NextResponse } from "next/server";
import { z } from "zod";
import { createCopilot } from "@/lib/copilot";
import { copilotKeyName, isCopilotConfigured } from "@/lib/copilot/env";
import { publicRecord, type CopilotEvent } from "@/lib/copilot/loop";

export const dynamic = "force-dynamic";
/** The tool loop (up to 8 calls) and a creator card can outlast a serverless default; Vercel reads this. */
export const maxDuration = 60;

const bodySchema = z.object({
  question: z.string().min(1).max(2000),
  history: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(20_000) })).max(20).default([]),
});

/** Streams the copilot's answer as server-sent events: text deltas, each tool call, then done. */
export async function POST(request: Request) {
  if (!isCopilotConfigured()) {
    return NextResponse.json({ error: `Not configured: ${copilotKeyName()}` }, { status: 503 });
  }
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  const { question, history } = parsed.data;

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: CopilotEvent) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      try {
        const copilot = createCopilot();
        await copilot.ask(question, history, (event) => {
          if (event.type === "tool_call") send({ type: "tool_call", call: publicRecord(event.call) });
          else if (event.type === "done") send({ ...event, calls: event.calls.map(publicRecord) });
          else send(event);
        });
      } catch (err) {
        send({ type: "error", message: err instanceof Error ? err.message : "Copilot failed" });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache", Connection: "keep-alive" },
  });
}
