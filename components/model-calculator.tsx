"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, Line, LineChart, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CountUp } from "@/components/count-up";
import { BOUNDS, MEMBERSHIP_PRICE, PLANS, PLAN_KIT_PRICE, PLAN_RETEST_RATE, project, sensitivity, yearSummary, type ModelInputs, type Plan } from "@/lib/model/formulas";
import { parseInputs, serializeInputs } from "@/lib/model/url";

const PLAN_LABEL: Record<Plan, string> = { standalone: "Standalone test", membership_first: "Membership first", study: "Study tier" };
const PLAN_HUE: Record<Plan, string> = { standalone: "var(--chart-kits)", membership_first: "var(--chart-membership)", study: "var(--chart-brand)" };
const SENSITIVITY_RATES = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9];
const TOOLTIP = { background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 6, color: "var(--text)", fontSize: 13 };

/** Sliders in; six numbers, four charts and a year table out. Every change is written to the URL so the state can be linked. */
export function ModelCalculator() {
  const params = useSearchParams();
  const [inputs, setInputs] = useState<ModelInputs>(() => parseInputs(params));
  const projection = useMemo(() => project(inputs), [inputs]);
  const curves = useMemo(() => sensitivity(inputs, SENSITIVITY_RATES), [inputs]);
  const years = useMemo(() => yearSummary(projection), [projection]);
  const persona = params.get("as");

  useEffect(() => {
    const next = serializeInputs(inputs);
    if (persona) next.set("as", persona);
    const query = next.toString();
    window.history.replaceState(null, "", query ? `?${query}` : window.location.pathname);
  }, [inputs, persona]);

  const set = <K extends keyof ModelInputs>(key: K, value: ModelInputs[K]) => setInputs((prev) => ({ ...prev, [key]: value }));
  const h = projection.horizon;
  const arrRows = projection.rows.map((r) => ({ month: r.month, Kits: r.kitRevenue * 12, Membership: r.membershipRevenue * 12, "Brand portal": r.brandRevenue * 12 }));
  const valuationRows = projection.rows.map((r) => ({ month: r.month, valuation: r.valuation, low: r.arr * BOUNDS.multiple.min, high: r.arr * BOUNDS.multiple.max }));
  const sensitivityRows = curves.map((c) => ({ rate: c.rate, ...c.byPlan }));
  const kitShare = h.arr ? (h.kitRevenue * 12) / h.arr : 0;
  const memberShare = h.arr ? (h.membershipRevenue * 12) / h.arr : 0;

  return (
    <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(18rem,1fr)_minmax(0,3fr)]">
      <div className="flex flex-col gap-5 self-start rounded-panel border border-line bg-surface p-5 xl:sticky xl:top-6">
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
          <p className="text-13 text-muted">Kit ${PLAN_KIT_PRICE[inputs.plan]}, membership ${MEMBERSHIP_PRICE} a month, plan default retest rate {pct0(PLAN_RETEST_RATE[inputs.plan])}.</p>
        </fieldset>

        <Slider
          label={`Retest rate${inputs.retestRate === null ? " (plan default)" : ""}`}
          value={projection.retestRate}
          bounds={BOUNDS.retestRate}
          format={pct0}
          onChange={(v) => set("retestRate", v)}
          accent
        />
        <Slider label="New customers per month" value={inputs.newCustomers} bounds={BOUNDS.newCustomers} format={(v) => v.toLocaleString("en-US")} onChange={(v) => set("newCustomers", v)} />
        <Slider label="Monthly growth in new customers" value={inputs.growth} bounds={BOUNDS.growth} format={pct1} onChange={(v) => set("growth", v)} />
        <Slider label="Monthly membership churn after month 3" value={inputs.churn} bounds={BOUNDS.churn} format={pct1} onChange={(v) => set("churn", v)} />
        <Slider label="Brand-portal take rate on partner GMV" value={inputs.takeRate} bounds={BOUNDS.takeRate} format={pct0} onChange={(v) => set("takeRate", v)} />
        <Slider label="Partner GMV per retested customer per year" value={inputs.partnerGmvPerYear} bounds={BOUNDS.partnerGmvPerYear} format={usd0} onChange={(v) => set("partnerGmvPerYear", v)} />
        <Slider label="Horizon (months)" value={inputs.horizon} bounds={BOUNDS.horizon} format={(v) => String(v)} onChange={(v) => set("horizon", v)} />
        <Slider label="Valuation multiple on ARR" value={inputs.multiple} bounds={BOUNDS.multiple} format={(v) => `${v}×`} onChange={(v) => set("multiple", v)} />
      </div>

      <div className="flex flex-col gap-6">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <Output label={`Implied valuation, month ${h.month}`} value={h.valuation} format={usdShort} detail={`${inputs.multiple}× ARR`} accent />
          <Output label="ARR at horizon" value={h.arr} format={usdShort} detail={`${pct0(memberShare)} membership, ${pct0(kitShare)} kits`} />
          <Output label="Members" value={h.members} format={(v) => Math.round(v).toLocaleString("en-US")} detail={`Paying $${MEMBERSHIP_PRICE} a month`} />
          <Output label="Retested customers" value={h.retestedCum} format={(v) => Math.round(v).toLocaleString("en-US")} detail="The dataset: labelled outcome pairs" />
          <Output label="Brand revenue, annual" value={h.brandRevenue * 12} format={usdShort} detail={`${pct0(inputs.takeRate)} of partner GMV, from month 18`} />
          <Output label="Retest rate in use" value={projection.retestRate} format={pct0} detail={inputs.retestRate === null ? "Plan default" : "Overridden"} />
        </div>

        <figure className="rounded-panel border border-line bg-surface p-5">
          <figcaption className="text-18">Annual recurring revenue by source</figcaption>
          <p className="mb-2 text-13 text-muted">Each month&apos;s revenue times twelve, stacked: membership, kits and the brand portal. Hover for the split in any month.</p>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={arrRows} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
                <CartesianGrid stroke="var(--line)" vertical={false} />
                <XAxis dataKey="month" tick={{ fill: "var(--muted)", fontSize: 13 }} tickLine={false} axisLine={{ stroke: "var(--line)" }} />
                <YAxis tickFormatter={usdShort} tick={{ fill: "var(--muted)", fontSize: 13 }} tickLine={false} axisLine={false} width={64} />
                <Tooltip formatter={(value) => usdShort(Number(value))} labelFormatter={(m) => `Month ${m}`} contentStyle={TOOLTIP} itemStyle={{ color: "var(--text)" }} cursor={{ stroke: "var(--muted)" }} />
                <Area type="monotone" dataKey="Membership" stackId="arr" stroke="var(--surface)" strokeWidth={2} fill="var(--chart-membership)" fillOpacity={1} isAnimationActive={false} />
                <Area type="monotone" dataKey="Kits" stackId="arr" stroke="var(--surface)" strokeWidth={2} fill="var(--chart-kits)" fillOpacity={1} isAnimationActive={false} />
                <Area type="monotone" dataKey="Brand portal" stackId="arr" stroke="var(--surface)" strokeWidth={2} fill="var(--chart-brand)" fillOpacity={1} isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <Legend items={[{ name: "Membership", color: "var(--chart-membership)" }, { name: "Kits", color: "var(--chart-kits)" }, { name: "Brand portal", color: "var(--chart-brand)" }]} />
        </figure>

        <div className="grid gap-6 lg:grid-cols-2">
          <figure className="rounded-panel border border-line bg-surface p-5">
            <figcaption className="text-18">What the company is worth, by retest rate</figcaption>
            <p className="mb-2 text-13 text-muted">Valuation at month {h.month} for each pricing model as the retest rate moves from 10% to 90%, everything else as set. The garnet line is the rate in use.</p>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={sensitivityRows} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
                  <CartesianGrid stroke="var(--line)" vertical={false} />
                  <XAxis dataKey="rate" type="number" domain={[0.1, 0.9]} ticks={SENSITIVITY_RATES} tickFormatter={pct0} tick={{ fill: "var(--muted)", fontSize: 13 }} tickLine={false} axisLine={{ stroke: "var(--line)" }} />
                  <YAxis tickFormatter={usdShort} tick={{ fill: "var(--muted)", fontSize: 13 }} tickLine={false} axisLine={false} width={64} />
                  <Tooltip formatter={(value, name) => [usdShort(Number(value)), PLAN_LABEL[name as Plan] ?? name]} labelFormatter={(r) => `Retest rate ${pct0(Number(r))}`} contentStyle={TOOLTIP} itemStyle={{ color: "var(--text)" }} cursor={{ stroke: "var(--muted)" }} />
                  <ReferenceLine x={projection.retestRate} stroke="var(--brand)" strokeWidth={2} />
                  {PLANS.map((plan) => (
                    <Line key={plan} type="monotone" dataKey={plan} stroke={PLAN_HUE[plan]} strokeWidth={plan === inputs.plan ? 3 : 2} strokeOpacity={plan === inputs.plan ? 1 : 0.6} dot={false} activeDot={{ r: 5 }} isAnimationActive={false} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
            <Legend items={PLANS.map((p) => ({ name: PLAN_LABEL[p], color: PLAN_HUE[p] }))} />
          </figure>

          <figure className="rounded-panel border border-line bg-surface p-5">
            <figcaption className="text-18">Valuation over time, with the multiple range</figcaption>
            <p className="mb-2 text-13 text-muted">The line is ARR times your multiple; the band is the same ARR at {BOUNDS.multiple.min}× to {BOUNDS.multiple.max}×, the range public consumer-health comparables have traded in.</p>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={valuationRows} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
                  <CartesianGrid stroke="var(--line)" vertical={false} />
                  <XAxis dataKey="month" tick={{ fill: "var(--muted)", fontSize: 13 }} tickLine={false} axisLine={{ stroke: "var(--line)" }} />
                  <YAxis tickFormatter={usdShort} tick={{ fill: "var(--muted)", fontSize: 13 }} tickLine={false} axisLine={false} width={64} />
                  <Tooltip formatter={(value, name) => [usdShort(Number(value)), name === "valuation" ? `At ${inputs.multiple}×` : name === "high" ? `At ${BOUNDS.multiple.max}×` : `At ${BOUNDS.multiple.min}×`]} labelFormatter={(m) => `Month ${m}`} contentStyle={TOOLTIP} itemStyle={{ color: "var(--text)" }} cursor={{ stroke: "var(--muted)" }} />
                  <Area type="monotone" dataKey="high" stroke="none" fill="var(--chart-kits)" fillOpacity={0.14} isAnimationActive={false} />
                  <Area type="monotone" dataKey="low" stroke="none" fill="var(--surface)" fillOpacity={1} isAnimationActive={false} />
                  <Area type="monotone" dataKey="valuation" stroke="var(--chart-kits)" strokeWidth={2} fill="none" isAnimationActive={false} />
                  <ReferenceArea x1={18} x2={24} fill="var(--chart-brand)" fillOpacity={0.08} label={{ value: "brand portal ramps", position: "insideTop", fill: "var(--muted)", fontSize: 12 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </figure>
        </div>

        <section className="overflow-hidden rounded-panel border border-line">
          <div className="border-b border-line bg-surface px-5 py-3">
            <h2 className="text-18">Year by year</h2>
          </div>
          <table className="w-full text-15">
            <thead className="bg-surface text-left text-13 text-muted">
              <tr><Th>Year</Th><Th right>New customers</Th><Th right>Members at year end</Th><Th right>Retested, cumulative</Th><Th right>ARR</Th><Th right>Brand revenue</Th><Th right>Valuation</Th></tr>
            </thead>
            <tbody>
              {years.map((y) => (
                <tr key={y.year} className="border-t border-line">
                  <td className="px-5 py-2">Year {y.year}<span className="ml-2 text-13 text-muted">month {y.endMonth}</span></td>
                  <td className="px-3 py-2 text-right">{Math.round(y.newCustomers).toLocaleString("en-US")}</td>
                  <td className="px-3 py-2 text-right">{Math.round(y.members).toLocaleString("en-US")}</td>
                  <td className="px-3 py-2 text-right">{Math.round(y.retestedCum).toLocaleString("en-US")}</td>
                  <td className="px-3 py-2 text-right">{usdShort(y.arr)}</td>
                  <td className="px-3 py-2 text-right">{usdShort(y.brandRevenueAnnual)}</td>
                  <td className="px-5 py-2 text-right text-accent">{usdShort(y.valuation)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <details className="rounded-panel border border-line bg-surface p-5 text-15">
          <summary className="cursor-pointer">How it is computed</summary>
          <dl className="mt-3 grid gap-x-8 gap-y-2 text-13 sm:grid-cols-2">
            <Formula k="Kit revenue" v="new customers × kit price for the plan ($249, $99, $149)" />
            <Formula k="Members" v="last month × (1 − churn) + new customers × join rate (25%, 100%, 100%); churn starts after month 3 and applies only to members who have not retested" />
            <Formula k="Retested, cumulative" v="Σ new customers × retest rate, counted three months after the order" />
            <Formula k="Brand revenue" v="(retested ÷ 12) × partner GMV per year ÷ 12 × take rate, ramping from month 18 to 24" />
            <Formula k="ARR" v="12 × (kit revenue + membership revenue + brand revenue) in the month" />
            <Formula k="Valuation" v="ARR × multiple; the 6× to 25× range brackets public reporting on consumer-health companies with a recurring test" />
          </dl>
        </details>
      </div>
    </div>
  );
}

function Formula({ k, v }: { k: string; v: string }) {
  return (
    <div className="border-b border-line py-1.5">
      <dt className="text-muted">{k}</dt>
      <dd>{v}</dd>
    </div>
  );
}

function Legend({ items }: { items: { name: string; color: string }[] }) {
  return (
    <ul className="flex flex-wrap justify-center gap-4 pt-2 text-13 text-muted">
      {items.map((s) => (
        <li key={s.name} className="flex items-center gap-1.5">
          <span aria-hidden="true" className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} />
          {s.name}
        </li>
      ))}
    </ul>
  );
}

type SliderProps = { label: string; value: number; bounds: { min: number; max: number; step: number }; format: (v: number) => string; onChange: (v: number) => void; accent?: boolean };

function Slider({ label, value, bounds, format, onChange, accent }: SliderProps) {
  return (
    <label className="flex flex-col gap-1 text-15">
      <span className="flex justify-between">
        <span className="text-muted">{label}</span>
        <span className={accent ? "text-brand" : ""}>{format(value)}</span>
      </span>
      <input type="range" min={bounds.min} max={bounds.max} step={bounds.step} value={value} onChange={(e) => onChange(Number(e.target.value))} className={accent ? "accent-brand" : "accent-live"} />
    </label>
  );
}

function Output({ label, value, format, detail, accent }: { label: string; value: number; format: (v: number) => string; detail?: string; accent?: boolean }) {
  return (
    <div className={`rounded-panel border bg-surface px-4 py-3 ${accent ? "border-brand" : "border-line"}`}>
      <p className="text-13 text-muted">{label}</p>
      <p className={`text-32 leading-none ${accent ? "text-brand" : ""}`}><CountUp value={value} format={format} /></p>
      {detail ? <p className="mt-1 text-13 text-muted">{detail}</p> : null}
    </div>
  );
}

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return <th scope="col" className={`px-3 py-2 font-medium first:px-5 ${right ? "text-right" : ""}`}>{children}</th>;
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
