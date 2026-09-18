"use client";

import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export type SegmentBar = { segment: string; value: number | null; n: number | null };

/** One rate per segment, one hue, the sample size on every bar; suppressed segments are listed under the chart, never drawn as zero. */
export function SegmentBarChart({ bars, label }: { bars: SegmentBar[]; label: string }) {
  const shown = bars.filter((b) => b.value !== null);
  const suppressed = bars.filter((b) => b.value === null).map((b) => b.segment);
  return (
    <>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={shown} margin={{ top: 20, right: 16, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="var(--line)" vertical={false} />
            <XAxis dataKey="segment" tick={{ fill: "var(--text)", fontSize: 13 }} tickLine={false} axisLine={{ stroke: "var(--line)" }} />
            <YAxis domain={[0, 1]} tickFormatter={(v) => `${Math.round(Number(v) * 100)}%`} tick={{ fill: "var(--muted)", fontSize: 13 }} tickLine={false} axisLine={false} width={44} />
            <Tooltip
              formatter={(value, _n, item) => [`${(Number(value) * 100).toFixed(0)}% of ${(item as { payload?: { n: number | null } }).payload?.n ?? "–"}`, label]}
              contentStyle={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 6, color: "var(--text)", fontSize: 13 }}
              itemStyle={{ color: "var(--text)" }}
              cursor={{ fill: "var(--raised)" }}
            />
            <Bar dataKey="value" fill="var(--chart-kits)" radius={[4, 4, 0, 0]} maxBarSize={44} isAnimationActive={false}>
              <LabelList dataKey="n" position="top" fill="var(--muted)" fontSize={12} formatter={(v: unknown) => `n ${v}`} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      {suppressed.length > 0 ? <p className="mt-2 text-13 text-muted">Below the minimum cohort: {suppressed.join(", ")}.</p> : null}
    </>
  );
}
