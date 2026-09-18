import { decideActionAction } from "@/lib/ops/actions";
import { humanise, type PendingActionRow } from "@/lib/ops/queries";

/** Proposals from the copilot and the sweep. Confirm records the decision; nothing is ever sent. */
export function PendingActions({ actions }: { actions: PendingActionRow[] }) {
  if (actions.length === 0) return <p className="px-4 py-6 text-15 text-muted">Nothing proposed. Ask the copilot or run the sweep.</p>;
  return (
    <ul className="divide-y divide-line">
      {actions.map((a) => (
        <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-15">
          <div className="min-w-0 flex-1">
            <p>
              {humanise(a.type)} to {a.customer?.first_name ?? "customer"}
              <span className="ml-2 text-13 text-muted">proposed by {a.proposed_by}, {kitCode(a.payload)}</span>
            </p>
            <p className="text-13 text-muted">{message(a.payload)}</p>
          </div>
          {a.status === "proposed" ? (
            <div className="flex gap-2">
              <form action={decideActionAction}>
                <input type="hidden" name="id" value={a.id} />
                <input type="hidden" name="decision" value="confirmed" />
                <button type="submit" className="rounded-control bg-brand px-3 py-1 text-13 font-medium text-on-brand">Confirm {shortType(a.type)}</button>
              </form>
              <form action={decideActionAction}>
                <input type="hidden" name="id" value={a.id} />
                <input type="hidden" name="decision" value="rejected" />
                <button type="submit" className="rounded-control border border-line px-3 py-1 text-13">Reject</button>
              </form>
            </div>
          ) : (
            <span className="text-13 text-muted">{humanise(a.status)}</span>
          )}
        </li>
      ))}
    </ul>
  );
}

function shortType(type: string): string {
  return type === "ticket_note" ? "note" : "nudge";
}

function message(payload: unknown): string {
  if (payload && typeof payload === "object" && "message" in payload && typeof payload.message === "string") return payload.message;
  return "";
}

function kitCode(payload: unknown): string {
  if (payload && typeof payload === "object" && "kit_code" in payload && typeof payload.kit_code === "string") return payload.kit_code;
  return "no kit";
}
