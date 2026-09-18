"use client";

import { Bar, BarChart, CartesianGrid, ErrorBar, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export type OutcomeBar = { arm: string; rate: number; n: number; error?: number };

/**
 * Improvement rate per arm with a 95% error bar on each, so a reader can see whether the two
 * bars are distinguishable at this cohort size without reading a sentence about it.
 */
export function OutcomeChart({ bars }: { bars: OutcomeBar[] }) {
  return (
    <div className="h-56">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={bars} margin={{ top: 24, right: 16, bottom: 0, left: 0 }} barCategoryGap={40}>
          <CartesianGrid stroke="var(--line)" vertical={false} />
          <XAxis dataKey="arm" tick={{ fill: "var(--text)", fontSize: 13 }} tickLine={false} axisLine={{ stroke: "var(--line)" }} />
          <YAxis domain={[0, 1.1]} ticks={[0, 0.25, 0.5, 0.75, 1]} tickFormatter={(v) => `${Math.round(Number(v) * 100)}%`} tick={{ fill: "var(--muted)", fontSize: 13 }} tickLine={false} axisLine={false} width={44} />
          <Tooltip
            formatter={(value, _n, item) => [`${(Number(value) * 100).toFixed(1)}% of ${(item as { payload?: { n: number } }).payload?.n ?? "–"}`, "improved at retest"]}
            contentStyle={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 6, color: "var(--text)", fontSize: 13 }}
            itemStyle={{ color: "var(--text)" }}
            cursor={{ fill: "var(--raised)" }}
          />
          <Bar dataKey="rate" fill="var(--chart-kits)" radius={[4, 4, 0, 0]} maxBarSize={56} isAnimationActive={false}>
            <LabelList dataKey="rate" position="insideTop" fill="#ffffff" fontSize={13} offset={10} formatter={(v: unknown) => `${Math.round(Number(v) * 100)}%`} />
            <ErrorBar dataKey="error" width={8} stroke="var(--text)" strokeWidth={1.5} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
