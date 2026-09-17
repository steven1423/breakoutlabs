"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CountUp } from "@/components/count-up";
import { BOUNDS, PLANS, PLAN_RETEST_RATE, project, type ModelInputs, type Plan } from "@/lib/model/formulas";
import { parseInputs, serializeInputs } from "@/lib/model/url";

const PLAN_LABEL: Record<Plan, string> = { standalone: "Standalone test", membership_first: "Membership first", study: "Study tier" };

/** Sliders in, five outputs and one chart out. Every change is written to the URL so the state can be linked. */
export function ModelCalculator() {
  const params = useSearchParams();
  const [inputs, setInputs] = useState<ModelInputs>(() => parseInputs(params));
  const projection = useMemo(() => project(inputs), [inputs]);
  const persona = params.get("as");

  useEffect(() => {
    const next = serializeInputs(inputs);
    if (persona) next.set("as", persona);
    const query = next.toString();
    window.history.replaceState(null, "", query ? `?${query}` : window.location.pathname);
  }, [inputs, persona]);

  const set = <K extends keyof ModelInputs>(key: K, value: ModelInputs[K]) => setInputs((prev) => ({ ...prev, [key]: value }));
  const h = projection.horizon;
  const chartRows = projection.rows.map((r) => ({ month: r.month, Kits: r.kitRevenue * 12, Membership: r.membershipRevenue * 12, "Brand portal": r.brandRevenue * 12 }));

  return (
    <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <div className="flex flex-col gap-5">
        <fieldset className="flex flex-col gap-2">
          <legend className="text-13 text-muted">Pricing model</legend>
          <div role="group" className="inline-flex rounded-control border border-line text-15">
            {PLANS.map((plan) => (
              <button
                key={plan}
                type="button"
                aria-pressed={inputs.plan === plan}
                onClick={() => setInputs((prev) => ({ ...prev, plan, retestRate: null }))}
                className={`px-3 py-1.5 first:rounded-l-control last:rounded-r-control ${inputs.plan === plan ? "bg-raised text-text" : "text-muted hover:text-text"}`}
              >
                {PLAN_LABEL[plan]}
              </button>
            ))}
          </div>
        </fieldset>

        <Slider label="New customers per month" value={inputs.newCustomers} bounds={BOUNDS.newCustomers} format={(v) => v.toLocaleString("en-US")} onChange={(v) => set("newCustomers", v)} />
        <Slider label="Monthly growth in new customers" value={inputs.growth} bounds={BOUNDS.growth} format={pct1} onChange={(v) => set("growth", v)} />
        <Slider
          label={`Retest rate${inputs.retestRate === null ? ` (plan default ${pct0(PLAN_RETEST_RATE[inputs.plan])})` : ""}`}
          value={projection.retestRate}
          bounds={BOUNDS.retestRate}
          format={pct0}
          onChange={(v) => set("retestRate", v)}
          accent
        />
        <Slider label="Monthly membership churn after month 3" value={inputs.churn} bounds={BOUNDS.churn} format={pct1} onChange={(v) => set("churn", v)} />
        <Slider label="Brand-portal take rate on partner GMV" value={inputs.takeRate} bounds={BOUNDS.takeRate} format={pct0} onChange={(v) => set("takeRate", v)} />
        <Slider label="Partner GMV per retested customer per year" value={inputs.partnerGmvPerYear} bounds={BOUNDS.partnerGmvPerYear} format={usd0} onChange={(v) => set("partnerGmvPerYear", v)} />
        <Slider label="Horizon (months)" value={inputs.horizon} bounds={BOUNDS.horizon} format={(v) => String(v)} onChange={(v) => set("horizon", v)} />
        <Slider label="Valuation multiple on ARR" value={inputs.multiple} bounds={BOUNDS.multiple} format={(v) => `${v}×`} onChange={(v) => set("multiple", v)} />
      </div>

      <div className="flex flex-col gap-6">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          <Output label={`Implied valuation, month ${h.month}`} value={h.valuation} format={usdShort} accent />
          <Output label="ARR" value={h.arr} format={usdShort} />
          <Output label="Members" value={h.members} format={(v) => Math.round(v).toLocaleString("en-US")} />
          <Output label="Dataset size (retested customers)" value={h.retestedCum} format={(v) => Math.round(v).toLocaleString("en-US")} />
          <Output label="Brand revenue (annual)" value={h.brandRevenue * 12} format={usdShort} />
          <Output label="Retest rate in use" value={projection.retestRate} format={pct0} />
        </div>

        <figure className="rounded-panel border border-line bg-surface p-4">
          <figcaption className="text-15">ARR by source over the horizon</figcaption>
          <p className="mb-2 text-13 text-muted">Membership, kits and the brand portal, each as twelve times the monthly revenue.</p>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartRows} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
                <CartesianGrid stroke="var(--line)" vertical={false} />
                <XAxis dataKey="month" tick={{ fill: "var(--muted)", fontSize: 13 }} tickLine={false} axisLine={{ stroke: "var(--line)" }} label={{ value: "Month", position: "insideBottomRight", fill: "var(--muted)", fontSize: 13, dy: 10 }} />
                <YAxis tickFormatter={usdShort} tick={{ fill: "var(--muted)", fontSize: 13 }} tickLine={false} axisLine={false} width={64} />
                <Tooltip
                  formatter={(value) => usdShort(Number(value))}
                  labelFormatter={(m) => `Month ${m}`}
                  contentStyle={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 6, color: "var(--text)", fontSize: 13 }}
                  itemStyle={{ color: "var(--text)" }}
                  cursor={{ stroke: "var(--muted)" }}
                />
                <Legend content={() => <ChartLegend />} />
                <Area type="monotone" dataKey="Membership" stackId="arr" stroke="var(--surface)" strokeWidth={2} fill="var(--chart-membership)" fillOpacity={1} isAnimationActive={false} />
                <Area type="monotone" dataKey="Kits" stackId="arr" stroke="var(--surface)" strokeWidth={2} fill="var(--chart-kits)" fillOpacity={1} isAnimationActive={false} />
                <Area type="monotone" dataKey="Brand portal" stackId="arr" stroke="var(--surface)" strokeWidth={2} fill="var(--chart-brand)" fillOpacity={1} isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </figure>

        <details className="rounded-panel border border-line bg-surface p-4 text-15">
          <summary className="cursor-pointer">Month by month</summary>
          <div className="mt-3 max-h-72 overflow-auto">
            <table className="w-full text-13">
              <thead className="sticky top-0 bg-surface text-left text-muted">
                <tr><Th>Month</Th><Th right>New</Th><Th right>Members</Th><Th right>Retested</Th><Th right>ARR</Th><Th right>Valuation</Th></tr>
              </thead>
              <tbody>
                {projection.rows.map((r) => (
                  <tr key={r.month} className="border-t border-line">
                    <td className="px-2 py-1">{r.month}</td>
                    <td className="px-2 py-1 text-right">{Math.round(r.newCustomers).toLocaleString("en-US")}</td>
                    <td className="px-2 py-1 text-right">{Math.round(r.members).toLocaleString("en-US")}</td>
                    <td className="px-2 py-1 text-right">{Math.round(r.retestedCum).toLocaleString("en-US")}</td>
                    <td className="px-2 py-1 text-right">{usdShort(r.arr)}</td>
                    <td className="px-2 py-1 text-right">{usdShort(r.valuation)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
        <p className="text-13 text-muted">
          Assumptions beyond §11, each one line in the code: retests count three months after the order; brand revenue ramps from month 18 to 24; members who retest do not churn, so churn applies to the share that has not.
        </p>
      </div>
    </div>
  );
}

type SliderProps = { label: string; value: number; bounds: { min: number; max: number; step: number }; format: (v: number) => string; onChange: (v: number) => void; accent?: boolean };

const SERIES = [
  { name: "Membership", color: "var(--chart-membership)" },
  { name: "Kits", color: "var(--chart-kits)" },
  { name: "Brand portal", color: "var(--chart-brand)" },
];

/**
 * The stacked areas draw a surface-coloured stroke as the 2px gap between them, which made
 * the default legend paint itself surface on surface. This one owns its colours.
 */
function ChartLegend() {
  return (
    <ul className="flex flex-wrap justify-center gap-4 pt-2 text-13 text-muted">
      {SERIES.map((s) => (
        <li key={s.name} className="flex items-center gap-1.5">
          <span aria-hidden="true" className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} />
          {s.name}
        </li>
      ))}
    </ul>
  );
}

function Slider({ label, value, bounds, format, onChange, accent }: SliderProps) {
  return (
    <label className="flex flex-col gap-1 text-15">
      <span className="flex justify-between">
        <span className="text-muted">{label}</span>
        <span className={accent ? "text-accent" : ""}>{format(value)}</span>
      </span>
      <input type="range" min={bounds.min} max={bounds.max} step={bounds.step} value={value} onChange={(e) => onChange(Number(e.target.value))} className={accent ? "accent-accent" : "accent-live"} />
    </label>
  );
}

function Output({ label, value, format, accent }: { label: string; value: number; format: (v: number) => string; accent?: boolean }) {
  return (
    <div className={`rounded-panel border bg-surface px-4 py-3 ${accent ? "border-accent" : "border-line"}`}>
      <p className="text-13 text-muted">{label}</p>
      <p className="text-24"><CountUp value={value} format={format} /></p>
    </div>
  );
}

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return <th scope="col" className={`px-2 py-1 font-medium ${right ? "text-right" : ""}`}>{children}</th>;
}

const pct0 = (v: number) => `${Math.round(v * 100)}%`;
const pct1 = (v: number) => `${(v * 100).toFixed(1)}%`;
const usd0 = (v: number) => `$${Math.round(v).toLocaleString("en-US")}`;
function usdShort(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `$${Math.round(v / 1e3)}K`;
  return `$${Math.round(v)}`;
}
