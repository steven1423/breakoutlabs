import type { Metadata } from "next";
import Link from "next/link";
import { DataBadge } from "@/components/badge";
import { DiscoverButton } from "@/components/discover-button";
import { EmptyState } from "@/components/empty-state";
import { KpiRow } from "@/components/kpi";
import { Leaderboard } from "@/components/leaderboard";
import { PageHeader } from "@/components/page-header";
import { Pager } from "@/components/pager";
import { Segmented } from "@/components/segmented";
import { WhyThisPage } from "@/components/why";
import { rankBy } from "@/lib/attribution/metrics";
import { loadLeaderboard, type LeaderboardRow } from "@/lib/attribution/queries";
import { isConfigured } from "@/lib/env";
import { formatCount, formatUsd, loadCreators, type CreatorListRow } from "@/lib/growth/queries";
import { parsePersona, withPersona, type Persona } from "@/lib/personas";
import { pageOf, parsePage, withParams } from "@/lib/ui/paging";

export const metadata: Metadata = { title: "Creators" };
export const dynamic = "force-dynamic";

const CAPTION = "Discovery is a commodity. Ranking creators by retests is not.";
const PLATFORMS = ["youtube", "instagram", "tiktok"] as const;

type Params = Record<string, string | string[] | undefined>;
type Props = { searchParams: Promise<Params> };

export default async function GrowthPage({ searchParams }: Props) {
  const params = await searchParams;
  const persona = parsePersona(params.as);
  const tab = params.tab === "creators" ? "creators" : "leaderboard";
  const platform = (PLATFORMS as readonly string[]).includes(String(params.platform)) ? String(params.platform) : null;
  const page = parsePage(params.page);
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
        <PageHeader title="Creators" caption={CAPTION} status="seeded" reason="Database unavailable" />
        <EmptyState title="Could not load creators" body={`The database query failed: ${failure}. Check the Supabase env vars and try again.`} />
      </>
    );
  }

  const live = creators.filter((c) => c.data_status === "live").length;
  const partnered = new Set(leaderboard.map((r) => r.creator.id));
  const scored = creators.filter((c) => c.fitScore !== null).length;
  const spend = leaderboard.reduce((a, r) => a + r.spend, 0);
  const orders = leaderboard.reduce((a, r) => a + r.totals.orders, 0);
  const retested = leaderboard.reduce((a, r) => a + r.totals.retested, 0);
  const byFollowers = rankBy(leaderboard, "followers")[0];
  const byRetest = rankBy(leaderboard, "cost_per_retest")[0];

  const href = (patch: Record<string, string | number | null>) => `/growth${withParams(params, { as: persona, ...patch })}`;
  const filtered = platform ? creators.filter((c) => c.platform === platform) : creators;
  const creatorPage = pageOf(filtered, page, 20);

  return (
    <>
      <PageHeader
        title="Creators"
        caption={CAPTION}
        status={youtube ? "live" : "seeded"}
        reason={youtube ? `YouTube adapter live (${live} live rows); Instagram and TikTok rows seeded` : "Not configured: YOUTUBE_API_KEY, showing seeded creators"}
      />

      <KpiRow
        items={[
          { label: "Creators tracked", value: String(creators.length), detail: `${live} with live numbers, ${creators.length - live} seeded` },
          { label: "Scored by AI", value: String(scored), detail: "Have a fit score and an outreach draft" },
          { label: "Active campaigns", value: String(leaderboard.length), detail: `${formatUsd(spend)} spent in total` },
          { label: "Attributed orders", value: orders.toLocaleString("en-US"), detail: `${formatUsd(orders ? spend / orders : null)} blended cost per order` },
          { label: "Retests from creators", value: String(retested), detail: `${orders ? Math.round((retested / orders) * 100) : 0}% of attributed orders retested` },
          { label: "Blended cost per retest", value: formatUsd(retested ? spend / retested : null), detail: byRetest ? `Best: ${byRetest.creator.handle} at ${formatUsd(byRetest.metrics.costPerRetest)}` : "No retests yet", tone: "accent" },
        ]}
      />

      <WhyThisPage
        job="Find the creators whose audiences come back for the retest, and pay those, not the ones with the most followers."
        steps={[
          { title: "Discover and score", body: "The YouTube adapter finds channels talking about hormonal and adult acne; the AI card scores fit and drafts the outreach." },
          { title: "Partner with a code", body: "Every partnership gets a referral code, so every order, registration and retest traces back to one creator." },
          { title: "Rank by cost per retest", body: "Spend divided by attributed customers who completed a retest. Flip the toggle and watch the order change." },
        ]}
      />

      <section className="mt-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Segmented
            label="Growth view"
            active={tab}
            options={[
              { key: "leaderboard", label: "Campaign leaderboard", count: leaderboard.length, href: href({ tab: null, page: null, platform: null }) },
              { key: "creators", label: "All creators", count: creators.length, href: href({ tab: "creators", page: null }) },
            ]}
          />
          {tab === "creators" ? <DiscoverButton configured={youtube} /> : <DataBadge status="seeded" reason="Synthetic attribution, real maths" />}
        </div>

        {tab === "leaderboard" ? (
          <>
            {byFollowers && byRetest && byFollowers.campaignId !== byRetest.campaignId ? (
              <div className="mt-4 grid gap-3 rounded-panel border border-line bg-surface p-4 text-15 md:grid-cols-2">
                <p>
                  <span className="text-muted">By followers, </span>
                  <span>{byFollowers.creator.handle}</span>
                  <span className="text-muted"> leads: {formatCount(byFollowers.followers)} followers, {byFollowers.totals.orders} orders, {byFollowers.totals.retested} retests, {formatUsd(byFollowers.metrics.costPerRetest)} per retest.</span>
                </p>
                <p>
                  <span className="text-muted">By cost per retest, </span>
                  <span>{byRetest.creator.handle}</span>
                  <span className="text-muted"> leads: {formatCount(byRetest.followers)} followers, {byRetest.totals.orders} orders, {byRetest.totals.retested} retests, {formatUsd(byRetest.metrics.costPerRetest)} per retest. Same money, {byRetest.metrics.costPerRetest && byFollowers.metrics.costPerRetest ? Math.round(byFollowers.metrics.costPerRetest / byRetest.metrics.costPerRetest) : "–"}× the retests.</span>
                </p>
              </div>
            ) : null}
            {leaderboard.length === 0 ? <EmptyState title="No campaigns" body="Run pnpm seed to load the synthetic campaigns." /> : <Leaderboard rows={leaderboard} persona={persona} />}
          </>
        ) : (
          <>
            <div className="mt-4 flex flex-wrap items-center gap-3 text-13 text-muted">
              <span>Platform</span>
              <Segmented
                label="Platform filter"
                active={platform ?? "all"}
                options={[
                  { key: "all", label: "All", count: creators.length, href: href({ tab: "creators", platform: null, page: null }) },
                  ...PLATFORMS.map((p) => ({ key: p, label: p, count: creators.filter((c) => c.platform === p).length, href: href({ tab: "creators", platform: p, page: null }) })),
                ]}
              />
              <span>Stage: discovered by an adapter, scored by the AI card, partnered with a campaign code.</span>
            </div>
            <div className="mt-4 overflow-hidden rounded-panel border border-line">
              <CreatorTable rows={creatorPage.rows} partnered={partnered} persona={persona} />
              <Pager page={creatorPage} params={params} pathname="/growth" noun="creators" />
            </div>
          </>
        )}
      </section>
    </>
  );
}

function CreatorTable({ rows, partnered, persona }: { rows: CreatorListRow[]; partnered: Set<string>; persona: Persona }) {
  if (rows.length === 0) return <p className="px-4 py-6 text-15 text-muted">No creators yet. Press Discover on YouTube, or run pnpm seed for the seeded set.</p>;
  return (
    <div className="overflow-auto">
      <table className="w-full text-15">
        <thead className="sticky top-0 bg-surface text-left text-13 text-muted">
          <tr>
            <Th>Creator</Th>
            <Th>Platform</Th>
            <Th>Stage</Th>
            <Th right>Followers</Th>
            <Th right>Engagement</Th>
            <Th right>Avg views</Th>
            <Th right>Fit</Th>
            <Th>Found by</Th>
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
              <td className="px-4 py-2">{partnered.has(c.id) ? <span className="text-live">Partnered</span> : c.fitScore !== null ? "Scored" : <span className="text-muted">Discovered</span>}</td>
              <td className="px-4 py-2 text-right">{formatCount(c.followers)}</td>
              <td className="px-4 py-2 text-right">{c.engagement_rate === null ? "–" : `${(c.engagement_rate * 100).toFixed(1)}%`}</td>
              <td className="px-4 py-2 text-right">{formatCount(c.avg_views)}</td>
              <td className="whitespace-nowrap px-4 py-2 text-right">{c.fitScore === null ? "–" : `${c.fitScore} / 100`}</td>
              <td className="whitespace-nowrap px-4 py-2 text-muted">{SOURCE_LABEL[c.source] ?? c.source}</td>
              <td className="px-4 py-2"><DataBadge status={c.data_status} reason={c.enrich_error ?? undefined} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const SOURCE_LABEL: Record<string, string> = { youtube_api: "YouTube search", ig_business_discovery: "Instagram", search: "Web search", seeded: "Seed data" };

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return <th scope="col" className={`px-4 py-2 font-medium ${right ? "text-right" : ""}`}>{children}</th>;
}
