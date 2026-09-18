import type { Metadata } from "next";
import Link from "next/link";
import { CopilotLauncher } from "@/components/copilot-launcher";
import { EmptyState } from "@/components/empty-state";
import { KpiRow } from "@/components/kpi";
import { PageHeader } from "@/components/page-header";
import { Pager } from "@/components/pager";
import { PendingActions } from "@/components/pending-actions";
import { Pipeline, type StuckByState } from "@/components/pipeline";
import { RunSweep } from "@/components/run-sweep";
import { Segmented } from "@/components/segmented";
import { WhyThisPage } from "@/components/why";
import {
  humanise,
  listOpenTickets,
  listPendingActions,
  loadOpsCounts,
  loadOpsOverview,
  median,
  type KitListRow,
  type OpenTicketRow,
  type OpsOverview,
  type PendingActionRow,
} from "@/lib/ops/queries";
import { copilotLabel, isCopilotConfigured } from "@/lib/copilot/env";
import { parsePersona, withPersona, type Persona } from "@/lib/personas";
import { PAGE_SIZE, pageOf, parsePage, withParams, type Page } from "@/lib/ui/paging";

export const metadata: Metadata = { title: "Kits and tickets" };
export const dynamic = "force-dynamic";

const CAPTION = "Every one-star review is a missing state transition. This is where they get caught.";
const VIEWS = ["stuck", "actions", "tickets", "kits"] as const;
type View = (typeof VIEWS)[number];

type Params = Record<string, string | string[] | undefined>;
type Props = { searchParams: Promise<Params> };

export default async function OpsPage({ searchParams }: Props) {
  const params = await searchParams;
  const persona = parsePersona(params.as);
  const view: View = (VIEWS as readonly string[]).includes(String(params.view)) ? (params.view as View) : "stuck";
  const page = parsePage(params.page);

  let overview: OpsOverview | null = null;
  let counts: Awaited<ReturnType<typeof loadOpsCounts>> | null = null;
  let actions: Awaited<ReturnType<typeof listPendingActions>> | null = null;
  let tickets: Awaited<ReturnType<typeof listOpenTickets>> | null = null;
  let failure: string | null = null;
  try {
    [overview, counts, actions, tickets] = await Promise.all([
      loadOpsOverview(),
      loadOpsCounts(),
      view === "actions" ? listPendingActions(page, PAGE_SIZE) : Promise.resolve(null),
      view === "tickets" ? listOpenTickets(page, PAGE_SIZE) : Promise.resolve(null),
    ]);
  } catch (err) {
    failure = err instanceof Error ? err.message : "Unknown error";
  }

  if (!overview || !counts) {
    return (
      <>
        <PageHeader title="Kits and tickets" caption={CAPTION} status="seeded" reason="Database unavailable" />
        <EmptyState title="Could not load kits" body={`The database query failed: ${failure}. Check the Supabase env vars and try again.`} />
      </>
    );
  }

  const opsKits = overview.kits.filter((k) => k.sla.slaHours !== null && !k.sla.retention);
  const inFlight = overview.kits.filter((k) => !["cancelled", "refunded", "retest_ordered"].includes(k.state)).length;
  const compliance = opsKits.length ? 1 - overview.stuck.length / opsKits.length : 1;
  const typicalHours = median(opsKits.map((k) => k.sla.hoursIn));
  const retests = overview.kits.filter((k) => k.sequence_no > 1).length;
  const worst = overview.stuck[0];

  const stuckByState: StuckByState = {};
  for (const row of overview.stuck) stuckByState[row.state] = (stuckByState[row.state] ?? 0) + 1;

  const href = (patch: Record<string, string | number | null>) => `/ops${withParams(params, { as: persona, ...patch })}`;
  const options = [
    { key: "stuck", label: "Stuck kits", count: overview.stuck.length, href: href({ view: null, page: null }) },
    { key: "actions", label: "Proposed actions", count: counts.proposed, href: href({ view: "actions", page: null }) },
    { key: "tickets", label: "Open tickets", count: counts.openTickets, href: href({ view: "tickets", page: null }) },
    { key: "kits", label: "All kits", count: overview.total, href: href({ view: "kits", page: null }) },
  ];

  return (
    <>
      <PageHeader title="Kits and tickets" caption={CAPTION} status="seeded" reason="Synthetic customers, live queries" />
      <WhyThisPage
        job="Catch every kit that has stopped moving before the customer writes the review."
        steps={[
          { title: "Read the four phases", body: "Fulfilment, lab, results, retest loop. A garnet share is a kit past its SLA; boxed rows are the exception states." },
          { title: "Run the sweep", body: "It classifies every stuck kit, opens one ticket per kit and proposes a nudge. Running it twice changes nothing." },
          { title: "Work the queue", body: "Open the kit, fix the state, confirm or reject each nudge. Nothing is sent by this system; a confirmation is a record." },
        ]}
      />

      <KpiRow
        items={[
          { label: "Kits in flight", value: String(inFlight), detail: `${overview.total} kits in total, ${retests} of them retests` },
          { label: "Stuck past SLA", value: String(overview.stuck.length), detail: worst ? `Longest: ${worst.kit_code}, ${Math.floor(worst.sla.hoursOver)}h over` : "Nothing past its SLA", tone: overview.stuck.length ? "accent" : "live" },
          { label: "Inside SLA", value: `${Math.round(compliance * 100)}%`, detail: `${opsKits.length - overview.stuck.length} of ${opsKits.length} kits in ops states`, tone: compliance >= 0.9 ? "live" : "seeded" },
          { label: "Typical hours in state", value: `${Math.round(typicalHours)}h`, detail: "Median across kits in ops states" },
          { label: "Open tickets", value: String(counts.openTickets), detail: "Open or waiting on the customer" },
          { label: "Nudges awaiting a click", value: String(counts.proposed), detail: `${counts.decidedToday} decided in the last 24h` },
        ]}
      />

      <Pipeline counts={overview.countsByState} stuck={stuckByState} sla={overview.sla} />

      <CopilotLauncher configured={isCopilotConfigured()} label={copilotLabel()} />

      <section className="mt-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-24">Work queue</h2>
            <p className="text-15 text-muted">
              {overview.retention.length} more kits sit in retention states (viewed, retest due) and get nudges, not tickets.
            </p>
          </div>
          <RunSweep />
        </div>
        <div className="mt-4">
          <Segmented options={options} active={view} label="Queue view" />
        </div>
        <div className="mt-4 overflow-hidden rounded-panel border border-line">
          {view === "stuck" ? <StuckTable page={pageOf(overview.stuck, page)} overview={overview} persona={persona} params={params} /> : null}
          {view === "actions" && actions ? <ActionsView actions={actions} page={page} params={params} /> : null}
          {view === "tickets" && tickets ? <TicketsTable tickets={tickets} page={page} persona={persona} params={params} now={overview.nowMs} /> : null}
          {view === "kits" ? <KitTable page={pageOf(overview.kits, page)} persona={persona} params={params} /> : null}
        </div>
      </section>
    </>
  );
}

function StuckTable({ page, overview, persona, params }: { page: Page<KitListRow>; overview: OpsOverview; persona: Persona; params: Params }) {
  if (page.total === 0) return <p className="px-4 py-6 text-15 text-muted">Nothing is stuck. Every kit in an ops state is inside its SLA; run the sweep to double-check.</p>;
  return (
    <>
      <div className="overflow-auto">
        <table className="w-full text-15">
          <thead className="sticky top-0 bg-surface text-left text-13 text-muted">
            <tr>
              <Th>Kit</Th>
              <Th>Customer</Th>
              <Th>State</Th>
              <Th right>Hours over SLA</Th>
              <Th>Likely cause</Th>
              <Th>Ticket</Th>
            </tr>
          </thead>
          <tbody>
            {page.rows.map((row) => {
              const ticket = overview.ticketByKit.get(row.id);
              return (
                <tr key={row.id} className="border-t border-line">
                  <td className="px-4 py-2"><KitLink code={row.kit_code} persona={persona} /></td>
                  <td className="px-4 py-2">{row.customer?.first_name ?? "Unknown"}</td>
                  <td className="px-4 py-2 text-accent">{humanise(row.state)}</td>
                  <td className="px-4 py-2 text-right text-accent">{Math.floor(row.sla.hoursOver)}</td>
                  <td className="px-4 py-2 text-muted">{row.sla.cause ? humanise(row.sla.cause) : ""}</td>
                  <td className="px-4 py-2 text-muted">
                    {ticket ? <Link href={withPersona(`/ops/tickets/${ticket.id}`, persona)} className="underline decoration-line underline-offset-4 hover:decoration-text">Open, {ticket.likely_cause ? humanise(ticket.likely_cause) : "unclassified"}</Link> : "None yet"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <Pager page={page} params={params} pathname="/ops" noun="stuck kits" />
    </>
  );
}

function ActionsView({ actions, page, params }: { actions: { rows: PendingActionRow[]; total: number }; page: number; params: Params }) {
  const pageInfo = pageOf(Array.from({ length: actions.total }), page);
  return (
    <>
      <p className="border-b border-line px-4 py-2 text-13 text-muted">Confirm records the decision in pending_actions. No email or SMS is sent by this system.</p>
      <PendingActions actions={actions.rows} />
      <Pager page={pageInfo} params={params} pathname="/ops" noun="proposals" />
    </>
  );
}

function TicketsTable({ tickets, page, persona, params, now }: { tickets: { rows: OpenTicketRow[]; total: number }; page: number; persona: Persona; params: Params; now: number }) {
  const pageInfo = pageOf(Array.from({ length: tickets.total }), page);
  if (tickets.total === 0) return <p className="px-4 py-6 text-15 text-muted">No open tickets.</p>;
  return (
    <>
      <div className="overflow-auto">
        <table className="w-full text-15">
          <thead className="sticky top-0 bg-surface text-left text-13 text-muted">
            <tr>
              <Th>Subject</Th>
              <Th>Customer</Th>
              <Th>Kit</Th>
              <Th>Likely cause</Th>
              <Th>Channel</Th>
              <Th right>Days open</Th>
            </tr>
          </thead>
          <tbody>
            {tickets.rows.map((t) => (
              <tr key={t.id} className="border-t border-line">
                <td className="px-4 py-2">
                  <Link href={withPersona(`/ops/tickets/${t.id}`, persona)} className="underline decoration-line underline-offset-4 hover:decoration-text">{t.subject}</Link>
                  {t.status === "pending_customer" ? <span className="ml-2 text-13 text-muted">waiting on customer</span> : null}
                </td>
                <td className="px-4 py-2">{t.customer?.first_name ?? "Unknown"}</td>
                <td className="px-4 py-2">{t.kit ? <KitLink code={t.kit.kit_code} persona={persona} /> : <span className="text-muted">No kit</span>}</td>
                <td className="px-4 py-2 text-muted">{t.likely_cause ? humanise(t.likely_cause) : "Unclassified"}</td>
                <td className="px-4 py-2 text-muted">{t.channel}</td>
                <td className="px-4 py-2 text-right">{Math.floor((now - Date.parse(t.opened_at)) / 86_400_000)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pager page={pageInfo} params={params} pathname="/ops" noun="tickets" />
    </>
  );
}

function KitTable({ page, persona, params }: { page: Page<KitListRow>; persona: Persona; params: Params }) {
  return (
    <>
      <div className="overflow-auto">
        <table className="w-full text-15">
          <thead className="sticky top-0 bg-surface text-left text-13 text-muted">
            <tr>
              <Th>Kit</Th>
              <Th>Customer</Th>
              <Th>Plan</Th>
              <Th>State</Th>
              <Th right>Hours in state</Th>
              <Th>SLA</Th>
            </tr>
          </thead>
          <tbody>
            {page.rows.map((row) => (
              <tr key={row.id} className="border-t border-line">
                <td className="px-4 py-2">
                  <KitLink code={row.kit_code} persona={persona} />
                  {row.sequence_no > 1 ? <span className="ml-2 text-13 text-muted">retest</span> : null}
                </td>
                <td className="px-4 py-2">{row.customer?.first_name ?? "Unknown"}</td>
                <td className="px-4 py-2 text-muted">{humanise(row.customer?.plan ?? "")}</td>
                <td className={`px-4 py-2 ${row.sla.stuck && !row.sla.retention ? "text-accent" : ""}`}>{humanise(row.state)}</td>
                <td className="px-4 py-2 text-right">{Math.floor(row.sla.hoursIn)}</td>
                <td className="px-4 py-2 text-muted">{slaLabel(row)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pager page={page} params={params} pathname="/ops" noun="kits" />
    </>
  );
}

function slaLabel(row: KitListRow): string {
  if (row.sla.slaHours === null) return "No SLA";
  if (!row.sla.stuck) return `Within ${row.sla.slaHours}h`;
  return row.sla.retention ? "Retention" : `${Math.floor(row.sla.hoursOver)}h over`;
}

function KitLink({ code, persona }: { code: string; persona: Persona }) {
  return (
    <Link href={withPersona(`/ops/kits/${code}`, persona)} className="underline decoration-line underline-offset-4 hover:decoration-text">
      {code}
    </Link>
  );
}

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return <th scope="col" className={`px-4 py-2 font-medium ${right ? "text-right" : ""}`}>{children}</th>;
}
