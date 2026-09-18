import { DataBadge, type DataStatus } from "@/components/badge";

export type Tone = "default" | "accent" | "brand" | "live" | "seeded";

const VALUE_TONE: Record<Tone, string> = { default: "", accent: "text-accent", brand: "text-brand", live: "text-live", seeded: "text-seeded" };

export type KpiProps = {
  label: string;
  value: string;
  /** One short line under the value: the denominator, the comparison, or what the number is made of. */
  detail?: string;
  tone?: Tone;
  status?: DataStatus;
};

/** One headline number. The value is the point; the label says what it is and the detail says what it is made of. */
export function Kpi({ label, value, detail, tone = "default", status }: KpiProps) {
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-panel border border-line bg-surface px-4 py-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-13 text-muted">{label}</p>
        {status ? <DataBadge status={status} /> : null}
      </div>
      <p className={`text-32 leading-none ${VALUE_TONE[tone]}`}>{value}</p>
      {detail ? <p className="text-13 text-muted">{detail}</p> : null}
    </div>
  );
}

/** A row of headline numbers that fills the width. Six across on a wide screen, two on a phone. */
export function KpiRow({ items }: { items: KpiProps[] }) {
  return (
    <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      {items.map((k) => <Kpi key={k.label} {...k} />)}
    </div>
  );
}
