import { describe, expect, it } from "vitest";
import { flagFor } from "@/lib/synthetic/biomarkers";
import { DAY_MS, MARKERS, refRange } from "@/lib/synthetic/constants";
import { dataset } from "./helpers";

describe("panels and biomarkers", () => {
  const d = dataset();
  const customerById = new Map(d.customers.map((c) => [c.id, c]));
  const segmentById = new Map(d.customer_segments.map((s) => [s.customer_id, s.primary_segment]));
  const panelById = new Map(d.panels.map((p) => [p.id, p]));

  it("has eight markers per panel and flags agree with the reference range", () => {
    const perPanel = new Map<string, number>();
    for (const r of d.biomarker_results) {
      perPanel.set(r.panel_id, (perPanel.get(r.panel_id) ?? 0) + 1);
      const panel = panelById.get(r.panel_id)!;
      const sex = customerById.get(panel.customer_id)!.sex;
      expect(r.flag).toBe(flagFor(r.marker, sex, r.value));
      expect(refRange(r.marker, sex).unit).toBe(r.unit);
    }
    for (const n of perPanel.values()) expect(n).toBe(MARKERS.length);
  });

  it("baseline panels show the segment's driver out of range", () => {
    const baselines = d.panels.filter((p) => p.sequence_no === 1);
    let checked = 0;
    for (const p of baselines) {
      const segment = segmentById.get(p.customer_id);
      const rows = d.biomarker_results.filter((r) => r.panel_id === p.id);
      const flag = (m: string) => rows.find((r) => r.marker === m)!.flag;
      if (segment === "insulin") expect(flag("insulin"), p.id).toBe("high");
      else if (segment === "cortisol") expect(flag("cortisol"), p.id).toBe("high");
      else if (segment === "inflammation") expect(flag("hs_crp"), p.id).toBe("high");
      else if (segment === "androgen") {
        expect(flag("testosterone"), p.id).toBe("high");
        expect(flag("dhea_s"), p.id).toBe("high");
        expect(flag("shbg"), p.id).toBe("low");
      }
      else continue;
      checked++;
    }
    expect(checked).toBeGreaterThan(200);
  });

  it("retest panels exist only for retested customers, 85 to 110 days after baseline", () => {
    const retests = d.panels.filter((p) => p.sequence_no === 2);
    const retestedIds = new Set(d.attributions.filter((a) => a.retested).map((a) => a.customer_id));
    for (const id of retestedIds) expect(retests.some((p) => p.customer_id === id), id).toBe(true);
    for (const retest of retests) {
      const baseline = d.panels.find((p) => p.customer_id === retest.customer_id && p.sequence_no === 1)!;
      const kit = d.kits.find((k) => k.id === retest.kit_id)!;
      const days = (Date.parse(kit.created_at) - Date.parse(baseline.resulted_at)) / DAY_MS;
      expect(days).toBeGreaterThanOrEqual(85);
      expect(days).toBeLessThanOrEqual(110);
    }
    expect(retests.length).toBeGreaterThan(50);
  });

  it("outcomes reference both panels and mark improvement only when markers and severity both moved", () => {
    for (const o of d.outcomes) {
      expect(panelById.get(o.baseline_panel_id)!.sequence_no).toBe(1);
      expect(panelById.get(o.retest_panel_id)!.sequence_no).toBe(2);
      expect(o.improved).toBe(o.markers_improved > 0 && o.severity_delta <= -2);
    }
    const improvedShare = d.outcomes.filter((o) => o.improved).length / d.outcomes.length;
    expect(improvedShare).toBeGreaterThan(0.4);
    expect(improvedShare).toBeLessThan(0.9);
  });
});
