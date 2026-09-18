import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EmptyState } from "@/components/empty-state";
import { KitTimer } from "@/components/kit-timer";
import { PageHeader } from "@/components/page-header";
import { StateTrack } from "@/components/state-track";
import { staffFixAction } from "@/lib/ops/actions";
import { STAFF_FIXES } from "@/lib/ops/fixes";
import { humanise, loadKitDetail, type KitDetail } from "@/lib/ops/queries";
import { parsePersona, withPersona } from "@/lib/personas";
import { KIT_STATES, type KitState } from "@/lib/state-machine/transitions";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ kitCode: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return { title: `Kit ${(await params).kitCode}` };
}

export default async function KitPage({ params, searchParams }: Props) {
  const { kitCode } = await params;
  const persona = parsePersona((await searchParams).as);
  const detail = await loadKitDetail(kitCode);
  if (!detail) notFound();

  const { kit, customer, sla } = detail;
  const fix = STAFF_FIXES[kit.state];
  const counts = Object.fromEntries(KIT_STATES.map((s) => [s, s === kit.state ? 1 : 0])) as Record<KitState, number>;

  return (
    <>
      <p className="text-13">
        <Link href={withPersona("/ops", persona)} className="text-muted hover:text-text">Ops</Link>
      </p>
      <PageHeader
        title={`Kit ${kit.kit_code}`}
        caption={`${customer.first_name}, ${humanise(customer.plan)}, ${customer.region_state}. ${kit.sequence_no === 1 ? "Baseline kit." : `Retest ${kit.sequence_no - 1}.`}`}
        status="seeded"
        reason="Synthetic customer, live queries"
      />

      <section className="mt-6 rounded-panel border border-line bg-surface px-6 py-5">
        <p className="text-13 text-muted">Current state</p>
        <p className={`text-24 ${sla.stuck && !sla.retention ? "text-accent" : ""}`}>{humanise(kit.state)}</p>
        <KitTimer enteredAt={kit.state_entered_at} slaHours={sla.slaHours} />
        {sla.stuck ? (
          <p className="mt-1 text-15 text-muted">
            {sla.retention ? "Retention state: the customer went quiet." : `Likely cause: ${humanise(sla.cause ?? "other")}.`}
          </p>
        ) : null}
        {fix ? (
          <form action={staffFixAction} className="mt-4">
            <input type="hidden" name="kit_code" value={kit.kit_code} />
            <input type="hidden" name="from" value={kit.state} />
            <button type="submit" className="rounded-control bg-brand px-4 py-2 text-15 font-medium text-on-brand">{fix.label}</button>
            <span className="ml-3 text-13 text-muted">Moves the kit to {humanise(fix.to)} and records a staff event.</span>
          </form>
        ) : null}
      </section>

      <StateTrack counts={counts} activeState={kit.state} />
      <Timeline detail={detail} />
      <Tickets detail={detail} />
      <Actions detail={detail} />
    </>
  );
}

function Timeline({ detail }: { detail: KitDetail }) {
  const now = detail.nowMs;
  return (
    <section className="mt-10">
      <h2 className="text-24">Timeline</h2>
      <p className="text-15 text-muted">Every transition with the time the kit spent in each state.</p>
      <div className="mt-4 overflow-auto rounded-panel border border-line">
        <table className="w-full text-15">
          <thead className="sticky top-0 bg-surface text-left text-13 text-muted">
            <tr>
              <th className="px-4 py-2 font-medium">Entered</th>
              <th className="px-4 py-2 font-medium">State</th>
              <th className="px-4 py-2 font-medium">Actor</th>
              <th className="px-4 py-2 text-right font-medium">Hours in state</th>
              <th className="px-4 py-2 font-medium">SLA</th>
              <th className="px-4 py-2 font-medium">Note</th>
            </tr>
          </thead>
          <tbody>
            {detail.events.map((e, i) => {
              const next = detail.events[i + 1];
              const hours = ((next ? Date.parse(next.at) : now) - Date.parse(e.at)) / 3_600_000;
              const limit = detail.slaHours[e.to_state];
              const over = limit !== undefined && hours > limit;
              return (
                <tr key={e.id} className="border-t border-line">
                  <td className="px-4 py-2 text-muted">{formatDate(e.at)}</td>
                  <td className="px-4 py-2">{humanise(e.to_state)}{next ? "" : <span className="ml-2 text-13 text-muted">now</span>}</td>
                  <td className="px-4 py-2 text-muted">{humanise(e.actor)}</td>
                  <td className={`px-4 py-2 text-right ${over ? "text-accent" : ""}`}>{hours.toFixed(1)}</td>
                  <td className={`px-4 py-2 ${over ? "text-accent" : "text-muted"}`}>{limit === undefined ? "None" : over ? `${limit}h, exceeded` : `${limit}h`}</td>
                  <td className="px-4 py-2 text-muted">{e.note ?? ""}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Tickets({ detail }: { detail: KitDetail }) {
  return (
    <section className="mt-10">
      <h2 className="text-24">Tickets</h2>
      {detail.tickets.length === 0 ? (
        <EmptyState title="No tickets for this kit" body="The sweep opens one when the kit passes its SLA in an ops state." />
      ) : (
        <ul className="mt-4 divide-y divide-line rounded-panel border border-line">
          {detail.tickets.map((t) => (
            <li key={t.id} className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-3 text-15">
              <span>{t.subject}</span>
              <span className="text-13 text-muted">
                {humanise(t.status)}, {t.channel}, {formatDate(t.opened_at)}{t.likely_cause ? `, ${humanise(t.likely_cause)}` : ", unclassified"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Actions({ detail }: { detail: KitDetail }) {
  if (detail.actions.length === 0) return null;
  return (
    <section className="mt-10">
      <h2 className="text-24">Proposed actions</h2>
      <p className="text-15 text-muted">Nothing is sent. M3 adds the confirm and reject controls.</p>
      <ul className="mt-4 divide-y divide-line rounded-panel border border-line">
        {detail.actions.map((a) => (
          <li key={a.id} className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-3 text-15">
            <span>{humanise(a.type)}: {messageOf(a.payload)}</span>
            <span className="text-13 text-muted">{humanise(a.status)}, {formatDate(a.created_at)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function messageOf(payload: unknown): string {
  if (payload && typeof payload === "object" && "message" in payload && typeof payload.message === "string") return payload.message;
  return "";
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "UTC" });
}
