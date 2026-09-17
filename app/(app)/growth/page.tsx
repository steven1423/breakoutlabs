import type { Metadata } from "next";
import Link from "next/link";
import { DataBadge } from "@/components/badge";
import { DiscoverButton } from "@/components/discover-button";
import { EmptyState } from "@/components/empty-state";
import { Leaderboard } from "@/components/leaderboard";
import { PageHeader } from "@/components/page-header";
import { loadLeaderboard, type LeaderboardRow } from "@/lib/attribution/queries";
import { isConfigured } from "@/lib/env";
import { formatCount, loadCreators, type CreatorListRow } from "@/lib/growth/queries";
import { parsePersona, withPersona, type Persona } from "@/lib/personas";

export const metadata: Metadata = { title: "Growth" };
export const dynamic = "force-dynamic";

const CAPTION = "Discovery is a commodity. Ranking creators by retests is not.";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function GrowthPage({ searchParams }: Props) {
  const persona = parsePersona((await searchParams).as);
  const youtube = isConfigured("youtube");
  let creators: CreatorListRow[] = [];
  let leaderboard: LeaderboardRow[] = [];
  let failure: string | null = null;
  try {
    [creators, leaderboard] = await Promise.all([loadCreators(), loadLeaderboard()]);
  } catch (err) {
    failure = err instanceof Error ? err.message : "Unknown error";
  }

  if (failure) {
    return (
      <>
        <PageHeader title="Growth" caption={CAPTION} status="seeded" reason="Database unavailable" />
        <EmptyState title="Could not load creators" body={`The database query failed: ${failure}. Check the Supabase env vars and try again.`} />
      </>
    );
  }

  const live = creators.filter((c) => c.data_status === "live").length;
  return (
    <>
      <PageHeader
        title="Growth"
        caption={CAPTION}
        status={youtube ? "live" : "seeded"}
        reason={youtube ? `YouTube adapter live (${live} live rows); Instagram and TikTok rows seeded` : "Not configured: YOUTUBE_API_KEY, showing seeded creators"}
      />

      <section className="mt-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-24">Leaderboard</h2>
            <p className="text-15 text-muted">Seeded campaigns, real math. Cost per retest is spend over attributed customers who completed a retest.</p>
          </div>
          <DataBadge status="seeded" reason="Synthetic attribution" />
        </div>
        {leaderboard.length === 0 ? <EmptyState title="No campaigns" body="Run pnpm seed to load the synthetic campaigns." /> : <Leaderboard rows={leaderboard} persona={persona} />}
      </section>

      <section className="mt-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-24">Creators</h2>
            <p className="text-15 text-muted">{creators.length} rows. Each one says which adapter produced it and whether its numbers are live.</p>
          </div>
          <DiscoverButton configured={youtube} />
        </div>
        <CreatorTable rows={creators} persona={persona} />
      </section>
    </>
  );
}

function CreatorTable({ rows, persona }: { rows: CreatorListRow[]; persona: Persona }) {
  if (rows.length === 0) return <EmptyState title="No creators yet" body="Press Discover on YouTube, or run pnpm seed for the seeded set." />;
  return (
    <div className="mt-4 overflow-auto rounded-panel border border-line">
      <table className="w-full text-15">
        <thead className="sticky top-0 bg-surface text-left text-13 text-muted">
          <tr>
            <Th>Creator</Th>
            <Th>Platform</Th>
            <Th right>Followers</Th>
            <Th right>Engagement</Th>
            <Th right>Avg views</Th>
            <Th right>Fit</Th>
            <Th>Source</Th>
            <Th>Data</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => (
            <tr key={c.id} className="border-t border-line">
              <td className="px-4 py-2">
                <Link href={withPersona(`/growth/creators/${c.id}`, persona)} className="underline decoration-line underline-offset-4 hover:decoration-text">{c.handle}</Link>
                {c.display_name ? <span className="ml-2 text-13 text-muted">{c.display_name}</span> : null}
              </td>
              <td className="px-4 py-2 text-muted">{c.platform}</td>
              <td className="px-4 py-2 text-right">{formatCount(c.followers)}</td>
              <td className="px-4 py-2 text-right">{c.engagement_rate === null ? "–" : `${(c.engagement_rate * 100).toFixed(1)}%`}</td>
              <td className="px-4 py-2 text-right">{formatCount(c.avg_views)}</td>
              <td className="px-4 py-2 text-right">{c.fitScore === null ? "–" : `${c.fitScore} / 100`}</td>
              <td className="px-4 py-2 text-muted">{c.source}</td>
              <td className="px-4 py-2"><DataBadge status={c.data_status} reason={c.enrich_error ?? undefined} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return <th scope="col" className={`px-4 py-2 font-medium ${right ? "text-right" : ""}`}>{children}</th>;
}
