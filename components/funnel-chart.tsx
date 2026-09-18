"use client";

import { Bar, BarChart, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export type FunnelStep = { step: string; value: number };

/** A funnel as horizontal bars in one hue, each step labelled with its count and its conversion from the step before. */
export function FunnelChart({ steps }: { steps: FunnelStep[] }) {
  const data = steps.map((s, i) => ({ ...s, rate: i === 0 ? null : steps[i - 1].value > 0 ? s.value / steps[i - 1].value : 0 }));
  return (
    <div style={{ height: steps.length * 44 + 16 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 120, bottom: 4, left: 8 }} barCategoryGap={10}>
          <XAxis type="number" hide domain={[0, "dataMax"]} />
          <YAxis type="category" dataKey="step" width={150} tick={{ fill: "var(--text)", fontSize: 13 }} tickLine={false} axisLine={false} />
          <Tooltip
            formatter={(value, _n, item) => {
              const rate = (item as { payload?: { rate: number | null } }).payload?.rate;
              return [`${Number(value).toLocaleString("en-US")}${rate === null || rate === undefined ? "" : ` (${(rate * 100).toFixed(1)}% of the step before)`}`, ""];
            }}
            contentStyle={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 6, color: "var(--text)", fontSize: 13 }}
            itemStyle={{ color: "var(--text)" }}
            cursor={{ fill: "var(--raised)" }}
          />
          <Bar dataKey="value" fill="var(--chart-kits)" radius={[0, 4, 4, 0]} maxBarSize={22} isAnimationActive={false}>
            <LabelList dataKey="value" position="right" fill="var(--text)" fontSize={13} formatter={(v: unknown) => Number(v).toLocaleString("en-US")} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
