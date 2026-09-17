import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { RunSweep } from "@/components/run-sweep";
import { StateTrack, type TrackMarks } from "@/components/state-track";
import { Copilot } from "@/components/copilot";
import { PendingActions } from "@/components/pending-actions";
import { copilotLabel, isCopilotConfigured } from "@/lib/copilot/env";
import { humanise, listPendingActions, loadOpsOverview, type KitListRow, type OpsOverview } from "@/lib/ops/queries";
import { parsePersona, withPersona, type Persona } from "@/lib/personas";

export const metadata: Metadata = { title: "Ops" };
export const dynamic = "force-dynamic";

const CAPTION = "Every one-star review is a missing state transition. This is where they get caught.";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function OpsPage({ searchParams }: Props) {
  const persona = parsePersona((await searchParams).as);
  let overview: OpsOverview | null = null;
  let actions: Awaited<ReturnType<typeof listPendingActions>> | null = null;
  let failure: string | null = null;
  try {
    [overview, actions] = await Promise.all([loadOpsOverview(), listPendingActions()]);
  } catch (err) {
    failure = err instanceof Error ? err.message : "Unknown error";
  }

  if (!overview) {
    return (
      <>
        <PageHeader title="Ops" caption={CAPTION} status="seeded" reason="Database unavailable" />
        <EmptyState title="Could not load kits" body={`The database query failed: ${failure}. Check the Supabase env vars and try again.`} />
      </>
    );
  }

  return (
    <>
      <PageHeader title="Ops" caption={CAPTION} status="seeded" reason="Synthetic customers, live queries" />
      <StateTrack counts={overview.countsByState} marks={trackMarks(overview)} />

      <section className="mt-10">
        <h2 className="text-24">Copilot</h2>
        <p className="text-15 text-muted">Reads the database through typed tools and one guarded query. It never sends anything; it proposes.</p>
        <Copilot configured={isCopilotConfigured()} label={copilotLabel()} />
      </section>

      <section className="mt-10">
        <h2 className="text-24">Proposed actions</h2>
        <p className="text-15 text-muted">
          Confirm records the decision in pending_actions. No email or SMS is sent by this system.
          {actions && actions.proposedTotal > actions.actions.length
            ? ` Showing the newest ${actions.actions.length} of ${actions.proposedTotal} still proposed.`
            : ""}
        </p>
        <PendingActions actions={actions?.actions ?? []} />
      </section>

      <section className="mt-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-24">Stuck kits</h2>
            <p className="text-15 text-muted">
              {overview.stuck.length} past SLA in ops states. {overview.retention.length} more sit in retention states (viewed, retest due) and get nudges, not tickets.
            </p>
          </div>
          <RunSweep />
        </div>
        <StuckTable overview={overview} persona={persona} />
      </section>

      <section className="mt-10">
        <h2 className="text-24">All kits</h2>
        <p className="text-15 text-muted">{overview.total} kits, longest in state first.</p>
        <KitTable rows={overview.kits.slice(0, 100)} persona={persona} />
      </section>
    </>
  );
}

/** Stuck kits per state, so the rail can colour their marks. */
function trackMarks(overview: OpsOverview): TrackMarks {
  const marks: TrackMarks = {};
  for (const row of overview.stuck) marks[row.state] = { stuck: (marks[row.state]?.stuck ?? 0) + 1 };
  return marks;
}

function StuckTable({ overview, persona }: { overview: OpsOverview; persona: Persona }) {
  if (overview.stuck.length === 0) {
    return <EmptyState title="Nothing is stuck" body="Every kit in an ops state is inside its SLA. Run the sweep to double-check." />;
  }
  return (
    <div className="mt-4 overflow-auto rounded-panel border border-line">
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
          {overview.stuck.map((row) => {
            const ticket = overview.ticketByKit.get(row.id);
            return (
              <tr key={row.id} className="border-t border-line">
                <td className="px-4 py-2"><KitLink row={row} persona={persona} /></td>
                <td className="px-4 py-2">{row.customer?.first_name ?? "Unknown"}</td>
                <td className="px-4 py-2 text-accent">{humanise(row.state)}</td>
                <td className="px-4 py-2 text-right text-accent">{Math.floor(row.sla.hoursOver)}</td>
                <td className="px-4 py-2 text-muted">{row.sla.cause ? humanise(row.sla.cause) : ""}</td>
                <td className="px-4 py-2 text-muted">{ticket ? (ticket.likely_cause ? `Open, ${humanise(ticket.likely_cause)}` : "Open, unclassified") : "None yet"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function KitTable({ rows, persona }: { rows: KitListRow[]; persona: Persona }) {
  return (
    <div className="mt-4 overflow-auto rounded-panel border border-line">
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
          {rows.map((row) => (
            <tr key={row.id} className="border-t border-line">
              <td className="px-4 py-2">
                <KitLink row={row} persona={persona} />
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
  );
}

function slaLabel(row: KitListRow): string {
  if (row.sla.slaHours === null) return "No SLA";
  if (!row.sla.stuck) return `Within ${row.sla.slaHours}h`;
  return row.sla.retention ? "Retention" : `${Math.floor(row.sla.hoursOver)}h over`;
}

function KitLink({ row, persona }: { row: KitListRow; persona: Persona }) {
  return (
    <Link href={withPersona(`/ops/kits/${row.kit_code}`, persona)} className="underline decoration-line underline-offset-4 hover:decoration-text">
      {row.kit_code}
    </Link>
  );
}

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return <th scope="col" className={`px-4 py-2 font-medium ${right ? "text-right" : ""}`}>{children}</th>;
}
