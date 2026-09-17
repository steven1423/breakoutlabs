"use client";

import { Bar, BarChart, CartesianGrid, LabelList, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export type DeltaSeries = { intervention: string; points: { marker: string; delta: number | null; n: number | null }[] };

const MARKER_LABEL: Record<string, string> = { testosterone: "Testo", dhea_s: "DHEA-S", shbg: "SHBG", cortisol: "Cortisol", insulin: "Insulin", vitamin_d: "Vit D", zinc: "Zinc", hs_crp: "hs-CRP" };

/**
 * Intervention → marker delta (CLAUDE.md §9): one small chart per intervention type, one hue,
 * mean change toward optimal per marker with the sample size on every bar. Suppressed markers are listed, not drawn.
 */
export function MarkerDeltaCharts({ series }: { series: DeltaSeries[] }) {
  return (
    <div className="mt-4 grid gap-4 md:grid-cols-2">
      {series.map((s) => {
        const shown = s.points.filter((p) => p.delta !== null);
        const suppressed = s.points.filter((p) => p.delta === null).map((p) => MARKER_LABEL[p.marker] ?? p.marker);
        return (
          <figure key={s.intervention} className="rounded-panel border border-line bg-surface p-4">
            <figcaption className="text-15">{s.intervention}</figcaption>
            <p className="mb-2 text-13 text-muted">Mean change toward optimal, in the units of each marker. The number on the bar is the sample size.</p>
            {shown.length === 0 ? (
              <p className="text-15 text-muted">Insufficient data for every marker at this threshold.</p>
            ) : (
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={shown.map((p) => ({ marker: MARKER_LABEL[p.marker] ?? p.marker, delta: p.delta, n: p.n }))} margin={{ top: 16, right: 8, bottom: 0, left: 0 }}>
                    <CartesianGrid stroke="var(--line)" vertical={false} />
                    <XAxis dataKey="marker" tick={{ fill: "var(--muted)", fontSize: 13 }} tickLine={false} axisLine={{ stroke: "var(--line)" }} />
                    <YAxis tick={{ fill: "var(--muted)", fontSize: 13 }} tickLine={false} axisLine={false} width={40} />
                    <ReferenceLine y={0} stroke="var(--muted)" />
                    <Tooltip
                      formatter={(value, _name, item) => [`${Number(value).toFixed(2)} (n ${(item as { payload?: { n?: number } }).payload?.n ?? "–"})`, "toward optimal"]}
                      contentStyle={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 6, color: "var(--text)", fontSize: 13 }}
                      cursor={{ fill: "var(--raised)" }}
                    />
                    <Bar dataKey="delta" fill="var(--chart-kits)" radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false}>
                      <LabelList dataKey="n" position="top" fill="var(--muted)" fontSize={12} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
            {suppressed.length > 0 ? <p className="mt-2 text-13 text-muted">Suppressed (below the minimum cohort): {suppressed.join(", ")}.</p> : null}
          </figure>
        );
      })}
    </div>
  );
}
