import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { aiSummarySchema } from "@/lib/copilot/summarize";
import { copilotKeyName, isCopilotConfigured } from "@/lib/copilot/env";
import { summarizeTicketAction } from "@/lib/ops/actions";
import { humanise, loadTicketDetail } from "@/lib/ops/queries";
import { parsePersona, withPersona } from "@/lib/personas";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Ticket" };

type Props = { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function TicketPage({ params, searchParams }: Props) {
  const { id } = await params;
  const persona = parsePersona((await searchParams).as);
  const detail = await loadTicketDetail(id);
  if (!detail) notFound();
  const { ticket, customer, kit } = detail;
  const summary = aiSummarySchema.safeParse(ticket.ai_summary);
  const configured = isCopilotConfigured();

  return (
    <>
      <p className="text-13">
        <Link href={withPersona("/ops", persona)} className="text-muted hover:text-text">Ops</Link>
      </p>
      <PageHeader
        title={ticket.subject}
        caption={`${customer?.first_name ?? "Unknown"}, ${humanise(customer?.plan ?? "")}. ${humanise(ticket.status)} via ${ticket.channel}, opened ${formatDate(ticket.opened_at)}.`}
        status="seeded"
        reason="Synthetic ticket, live queries"
      />

      <section className="mt-6 grid gap-6 md:grid-cols-2">
        <div className="rounded-panel border border-line bg-surface px-5 py-4">
          <p className="text-13 text-muted">Message</p>
          <p className="mt-1 whitespace-pre-wrap text-15">{ticket.body}</p>
          <p className="mt-3 text-13 text-muted">
            Likely cause: {ticket.likely_cause ? humanise(ticket.likely_cause) : "unclassified"}.
            {kit ? (
              <>
                {" "}Kit{" "}
                <Link href={withPersona(`/ops/kits/${kit.kit_code}`, persona)} className="underline decoration-line underline-offset-4 hover:decoration-text">{kit.kit_code}</Link>
                {" "}is in {humanise(kit.state)}.
              </>
            ) : null}
          </p>
        </div>

        <div className="rounded-panel border border-line bg-surface px-5 py-4">
          <div className="flex items-center justify-between">
            <p className="text-13 text-muted">AI summary</p>
            <form action={summarizeTicketAction}>
              <input type="hidden" name="id" value={ticket.id} />
              <button type="submit" disabled={!configured} className="rounded-control bg-brand px-3 py-1 text-13 font-medium text-on-brand disabled:opacity-60">
                {summary.success ? "Summarize again" : "Summarize"}
              </button>
            </form>
          </div>
          {summary.success ? (
            <div className="mt-2 flex flex-col gap-3 text-15">
              <p>{summary.data.summary}</p>
              <p className="text-13 text-muted">Likely cause: {humanise(summary.data.likely_cause)}</p>
              {summary.data.evidence.length > 0 ? (
                <ul className="list-disc pl-5 text-13 text-muted">
                  {summary.data.evidence.map((e) => <li key={e}>{e}</li>)}
                </ul>
              ) : null}
              <div>
                <p className="text-13 text-muted">Suggested reply</p>
                <p className="mt-1 whitespace-pre-wrap rounded-control bg-raised px-3 py-2">{summary.data.suggested_reply}</p>
              </div>
            </div>
          ) : (
            <p className="mt-2 text-15 text-muted">{configured ? "Not summarized yet. The copilot reads the ticket and the kit state, then drafts a reply for you to edit." : `Copilot not configured: set ${copilotKeyName()}.`}</p>
          )}
        </div>
      </section>
    </>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "UTC" });
}
