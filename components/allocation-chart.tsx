"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export type AllocationBar = { handle: string; thisRun: number; lastRun: number | null };

/**
 * This run against the last one, one row per campaign, largest first. The current split carries
 * the hue; the previous one is the gray context (emphasis, not two equal series).
 */
export function AllocationChart({ rows }: { rows: AllocationBar[] }) {
  const height = Math.max(240, rows.length * 34 + 40);
  const data = rows.map((r) => ({ ...r, lastRun: r.lastRun ?? 0 }));
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 24, bottom: 4, left: 8 }} barCategoryGap={8} barGap={2}>
          <CartesianGrid stroke="var(--line)" horizontal={false} />
          <XAxis type="number" tickFormatter={(v) => `$${Math.round(Number(v) / 100) / 10}K`} tick={{ fill: "var(--muted)", fontSize: 13 }} tickLine={false} axisLine={{ stroke: "var(--line)" }} />
          <YAxis type="category" dataKey="handle" width={170} tick={{ fill: "var(--text)", fontSize: 13 }} tickLine={false} axisLine={false} />
          <Tooltip
            formatter={(value, name) => [`$${Number(value).toLocaleString("en-US", { maximumFractionDigits: 0 })}`, name === "thisRun" ? "This run" : "Last run"]}
            contentStyle={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 6, color: "var(--text)", fontSize: 13 }}
            itemStyle={{ color: "var(--text)" }}
            cursor={{ fill: "var(--raised)" }}
          />
          <Bar dataKey="thisRun" fill="var(--chart-kits)" radius={[0, 4, 4, 0]} maxBarSize={14} isAnimationActive={false} />
          <Bar dataKey="lastRun" fill="var(--muted)" fillOpacity={0.45} radius={[0, 4, 4, 0]} maxBarSize={14} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
