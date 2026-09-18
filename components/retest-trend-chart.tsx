"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export type TrendPoint = { month: string; rate: number | null; n: number | null };

/** Retest rate by signup month, one line, suppressed months left as gaps rather than zeros. */
export function RetestTrendChart({ points }: { points: TrendPoint[] }) {
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 12, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="var(--line)" vertical={false} />
          <XAxis dataKey="month" tickFormatter={(m) => String(m).slice(2)} tick={{ fill: "var(--muted)", fontSize: 13 }} tickLine={false} axisLine={{ stroke: "var(--line)" }} />
          <YAxis domain={[0, 1]} tickFormatter={(v) => `${Math.round(Number(v) * 100)}%`} tick={{ fill: "var(--muted)", fontSize: 13 }} tickLine={false} axisLine={false} width={44} />
          <Tooltip
            formatter={(value, _n, item) => [`${(Number(value) * 100).toFixed(0)}% of ${(item as { payload?: { n: number | null } }).payload?.n ?? "–"} customers`, "retested"]}
            labelFormatter={(m) => `Signed up ${m}`}
            contentStyle={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 6, color: "var(--text)", fontSize: 13 }}
            itemStyle={{ color: "var(--text)" }}
            cursor={{ stroke: "var(--muted)" }}
          />
          <Line type="monotone" dataKey="rate" stroke="var(--chart-kits)" strokeWidth={2} dot={{ r: 4, fill: "var(--chart-kits)", strokeWidth: 0 }} activeDot={{ r: 6 }} connectNulls={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
