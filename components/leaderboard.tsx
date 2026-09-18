"use client";

import Link from "next/link";
import { useLayoutEffect, useRef, useState } from "react";
import { rankBy } from "@/lib/attribution/metrics";
import type { LeaderboardRow } from "@/lib/attribution/queries";
import { formatCount, formatPercent, formatUsd } from "@/lib/growth/queries";

type RankKey = "followers" | "cost_per_retest";

/**
 * The one toggle on the page (CLAUDE.md §8.7): rank by followers or by cost-per-retest.
 * The reorder is a FLIP transition on the rows; reduced motion skips it.
 */
export function Leaderboard({ rows, persona }: { rows: LeaderboardRow[]; persona: string }) {
  const [key, setKey] = useState<RankKey>("followers");
  const ranked = rankBy(rows, key);
  const rowRefs = useRef(new Map<string, HTMLTableRowElement>());
  const lastTops = useRef(new Map<string, number>());

  useLayoutEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const next = new Map<string, number>();
    for (const [id, el] of rowRefs.current) {
      const top = el.getBoundingClientRect().top;
      next.set(id, top);
      const before = lastTops.current.get(id);
      if (!reduced && before !== undefined && before !== top) {
        el.animate([{ transform: `translateY(${before - top}px)` }, { transform: "none" }], { duration: 450, easing: "cubic-bezier(0.2, 0, 0, 1)" });
      }
    }
    lastTops.current = next;
  }, [key]);

  return (
    <div className="mt-4">
      <div role="group" aria-label="Rank by" className="inline-flex rounded-control border border-accent/60 text-15">
        <ToggleButton active={key === "followers"} onClick={() => setKey("followers")}>Rank by followers</ToggleButton>
        <ToggleButton active={key === "cost_per_retest"} onClick={() => setKey("cost_per_retest")}>Rank by cost-per-retest</ToggleButton>
      </div>
      <div className="mt-4 overflow-auto rounded-panel border border-line">
        <table className="w-full text-15">
          <thead className="sticky top-0 bg-surface text-left text-13 text-muted">
            <tr>
              <Th right>#</Th>
              <Th>Creator</Th>
              <Th right>Followers</Th>
              <Th right>Spend</Th>
              <Th right>Orders</Th>
              <Th right>Retested</Th>
              <Th right>Retest rate</Th>
              <Th right>Cost per retest</Th>
              <Th right>CAC</Th>
              <Th right>LTV 90d</Th>
            </tr>
          </thead>
          <tbody>
            {ranked.map((row, i) => (
              <tr
                key={row.campaignId}
                ref={(el) => { if (el) rowRefs.current.set(row.campaignId, el); else rowRefs.current.delete(row.campaignId); }}
                className="border-t border-line"
              >
                <td className="px-4 py-2 text-right text-muted">{i + 1}</td>
                <td className="px-4 py-2">
                  <Link href={`/growth/creators/${row.creator.id}?as=${persona}`} className="underline decoration-line underline-offset-4 hover:decoration-text">
                    {row.creator.handle}
                  </Link>
                  <span className="ml-2 text-13 text-muted">{row.creator.platform}, {row.code}</span>
                </td>
                <td className="px-4 py-2 text-right">{formatCount(row.followers)}</td>
                <td className="px-4 py-2 text-right">{formatUsd(row.spend)}</td>
                <td className="px-4 py-2 text-right">{row.totals.orders}</td>
                <td className="px-4 py-2 text-right">{row.totals.retested}</td>
                <td className="px-4 py-2 text-right">{formatPercent(row.metrics.retestRate)}</td>
                <td className={`px-4 py-2 text-right ${key === "cost_per_retest" ? "text-live" : ""}`}>{formatUsd(row.metrics.costPerRetest)}</td>
                <td className="px-4 py-2 text-right">{formatUsd(row.metrics.cac)}</td>
                <td className="px-4 py-2 text-right">{formatUsd(row.metrics.ltv90d)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ToggleButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" aria-pressed={active} onClick={onClick} className={`px-3 py-1.5 first:rounded-l-control last:rounded-r-control ${active ? "bg-raised text-text" : "text-muted hover:text-text"}`}>
      {children}
    </button>
  );
}

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return <th scope="col" className={`px-4 py-2 font-medium ${right ? "text-right" : ""}`}>{children}</th>;
}
