import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DataBadge } from "@/components/badge";
import { KpiRow } from "@/components/kpi";
import { PageHeader } from "@/components/page-header";
import { copilotKeyName, copilotLabel, isCopilotConfigured } from "@/lib/copilot/env";
import { priceBand } from "@/lib/creators/pricing";
import { isConfigured } from "@/lib/env";
import { enrichCreatorAction, generateCardAction } from "@/lib/growth/actions";
import { formatCount, formatPercent, formatUsd, loadCreatorDetail, type CreatorDetail } from "@/lib/growth/queries";
import { parsePersona, withPersona } from "@/lib/personas";

export const metadata: Metadata = { title: "Creator" };
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

const SEGMENT_LABEL: Record<string, string> = { androgen: "Androgen", insulin: "Insulin", cortisol: "Cortisol", nutrient: "Nutrient", inflammation: "Inflammation", mixed: "Mixed" };

export default async function CreatorPage({ params, searchParams }: Props) {
  const { id } = await params;
  const persona = parsePersona((await searchParams).as);
  const detail = await loadCreatorDetail(id);
  if (!detail) notFound();
  const { creator, card, campaigns, crossLinks } = detail;
  const band = priceBand(creator.followers ?? 0, creator.engagement_rate);
  const titles = Array.isArray(creator.recent_titles) ? (creator.recent_titles as string[]) : [];
  const spend = campaigns.reduce((a, c) => a + c.spend, 0);
  const orders = campaigns.reduce((a, c) => a + c.totals.orders, 0);
  const retested = campaigns.reduce((a, c) => a + c.totals.retested, 0);
  const stage = campaigns.length ? "Partnered" : card ? "Scored" : "Discovered";

  return (
    <>
      <PageHeader
        title={creator.display_name || creator.handle}
        caption={`${creator.platform} · ${creator.handle} · ${stage}. Found by ${SOURCE_LABEL[creator.source] ?? creator.source}.`}
        status={creator.data_status}
        reason={creator.enrich_error ?? (creator.data_status === "live" ? `Fetched ${creator.enriched_at?.slice(0, 10) ?? ""}` : "Metrics not fetched from an API")}
      />
      <p className="mt-4 flex flex-wrap gap-4 text-15">
        <Link href={withPersona("/growth", persona)} className="underline decoration-line underline-offset-4 hover:decoration-text">Back to creators</Link>
        <a href={creator.url} target="_blank" rel="noreferrer" className="underline decoration-line underline-offset-4 hover:decoration-text">Open profile on {creator.platform}</a>
      </p>

      <KpiRow
        items={[
          { label: "Followers", value: formatCount(creator.followers), detail: `${band.tier} tier` },
          { label: "Engagement rate", value: creator.engagement_rate === null ? "–" : `${(creator.engagement_rate * 100).toFixed(1)}%`, detail: "Likes and comments over followers, last 12 posts" },
          { label: "Average views", value: formatCount(creator.avg_views), detail: "Last 12 posts" },
          { label: "AI fit score", value: card ? `${card.fit_score} / 100` : "–", detail: card ? `Predicted ${SEGMENT_LABEL[card.predicted_segment] ?? card.predicted_segment} audience` : "No card yet", tone: card && card.fit_score >= 70 ? "live" : "default" },
          { label: "Cost per retest", value: retested ? formatUsd(spend / retested) : "–", detail: campaigns.length ? `${retested} retests from ${orders} orders` : "No campaign yet", tone: "brand" },
          { label: "Price per post", value: `${formatUsd(band.low)} to ${formatUsd(band.high)}`, detail: "Estimate from tier and engagement" },
        ]}
      />

      <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <section className="rounded-panel border border-brand/50 bg-surface p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-24">AI creator card</h2>
              <p className="text-13 text-muted">Fit, audience, angle and an outreach draft from the bio, metrics and recent titles, then what the partnership has actually produced.</p>
            </div>
            {card ? <DataBadge status="live" reason={`${card.model}, ${card.generated_at.slice(0, 10)}`} /> : null}
          </div>
          {card ? <Card card={card} campaigns={campaigns} /> : <GenerateCard id={creator.id} campaigns={campaigns} />}
        </section>

        <div className="flex flex-col gap-6">
          <section className="rounded-panel border border-line bg-surface p-5">
            <h2 className="text-18">About</h2>
            <p className="mt-2 whitespace-pre-line text-15 text-muted">{creator.bio || "No bio on file."}</p>
            {titles.length > 0 ? (
              <>
                <p className="mt-4 text-13 text-muted">Recent titles</p>
                <ul className="mt-1 flex flex-col gap-1 text-15">
                  {titles.map((t, i) => <li key={i} className="border-t border-line pt-1 first:border-t-0">{t}</li>)}
                </ul>
              </>
            ) : null}
            <RefreshControls detail={detail} />
          </section>

          <section className="rounded-panel border border-line bg-surface p-5">
            <h2 className="text-18">Cross-links</h2>
            <p className="text-13 text-muted">Instagram and TikTok handles named in the bio. Their rows start Seeded until an adapter enriches them.</p>
            {crossLinks.length === 0 ? <p className="mt-2 text-15 text-muted">None found.</p> : (
              <ul className="mt-2 text-15">
                {crossLinks.map(({ stub, creatorId }) => (
                  <li key={`${stub.platform}:${stub.handle}`}>
                    {stub.platform} {stub.handle}
                    {creatorId ? <Link href={withPersona(`/growth/creators/${creatorId}`, persona)} className="ml-2 underline decoration-line underline-offset-4">open</Link> : null}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </>
  );
}

const SOURCE_LABEL: Record<string, string> = { youtube_api: "YouTube search", ig_business_discovery: "Instagram", search: "web search", seeded: "seed data" };

function RefreshControls({ detail }: { detail: CreatorDetail }) {
  const { creator } = detail;
  if (creator.platform === "tiktok") return <p className="mt-4 text-13 text-muted">TikTok metrics: future adapter. Handle and titles only.</p>;
  const configured = creator.platform === "youtube" ? isConfigured("youtube") : isConfigured("meta");
  const missing = creator.platform === "youtube" ? "YOUTUBE_API_KEY" : "META_ACCESS_TOKEN, META_IG_USER_ID";
  return (
    <form action={enrichCreatorAction} className="mt-4 flex flex-wrap items-center gap-3">
      <input type="hidden" name="id" value={creator.id} />
      <button type="submit" disabled={!configured} className="rounded-control border border-line px-3 py-1.5 text-15 disabled:opacity-60">
        {creator.platform === "youtube" ? "Refresh from YouTube" : "Enrich from Instagram"}
      </button>
      {!configured ? <span className="text-13 text-muted">Not configured: {missing}</span> : null}
    </form>
  );
}

function GenerateCard({ id, campaigns }: { id: string; campaigns: CreatorDetail["campaigns"] }) {
  const configured = isCopilotConfigured();
  return (
    <>
      <form action={generateCardAction} className="mt-4 flex flex-wrap items-center gap-3">
        <input type="hidden" name="id" value={id} />
        <button type="submit" disabled={!configured} className="rounded-control bg-brand px-4 py-2 text-15 font-medium text-on-brand disabled:opacity-60">Generate card</button>
        <span className="text-15 text-muted">{configured ? `Uses ${copilotLabel()}.` : `Not configured: ${copilotKeyName()}.`}</span>
      </form>
      <Campaigns campaigns={campaigns} />
    </>
  );
}

function Card({ card, campaigns }: { card: NonNullable<CreatorDetail["card"]>; campaigns: CreatorDetail["campaigns"] }) {
  return (
    <div className="mt-4 flex flex-col gap-5 text-15">
      <div className="grid gap-3 sm:grid-cols-3">
        <Fact label="Fit score" value={`${card.fit_score} / 100`} />
        <Fact label="Predicted audience" value={SEGMENT_LABEL[card.predicted_segment] ?? card.predicted_segment} />
        <Fact label="Price per post (estimate)" value={`${formatUsd(card.price_band_low)} to ${formatUsd(card.price_band_high)}`} />
      </div>
      <p className="text-18 leading-snug">{card.summary}</p>
      <div className="grid gap-5 md:grid-cols-2">
        <div>
          <p className="text-13 text-muted">Why this score</p>
          <p className="mt-1 whitespace-pre-line">{card.fit_reasoning}</p>
        </div>
        <div>
          <p className="text-13 text-muted">The angle</p>
          <p className="mt-1">{card.approach_angle}</p>
          <p className="mt-4 text-13 text-muted">Outreach draft</p>
          <p className="mt-1 whitespace-pre-line rounded-control border border-line bg-bg px-3 py-2">{card.outreach_draft}</p>
        </div>
      </div>
      <Campaigns campaigns={campaigns} />
    </div>
  );
}

/** What the partnership produced, inside the card, because the card's job is to say whether this creator is worth paying. */
function Campaigns({ campaigns }: { campaigns: CreatorDetail["campaigns"] }) {
  return (
    <div className="border-t border-line pt-4">
      <p className="text-18">Campaign results</p>
      {campaigns.length === 0 ? (
        <p className="mt-1 text-15 text-muted">No campaign yet. Partner with a referral code and every order, registration and retest lands here.</p>
      ) : (
        campaigns.map((c) => (
          <div key={c.campaignId} className="mt-3">
            <p className="text-13 text-muted">Code {c.code}, started {c.startAt.slice(0, 10)}</p>
            <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <Fact label="Spend" value={formatUsd(c.spend)} />
              <Fact label="Orders" value={String(c.totals.orders)} />
              <Fact label="Retested" value={`${c.totals.retested} (${formatPercent(c.metrics.retestRate)})`} />
              <Fact label="Cost per retest" value={formatUsd(c.metrics.costPerRetest)} accent />
              <Fact label="Cost per order" value={formatUsd(c.metrics.cac)} />
              <Fact label="LTV, 90 days" value={formatUsd(c.metrics.ltv90d)} />
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function Fact({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-control border border-line bg-bg px-3 py-2">
      <p className="text-13 text-muted">{label}</p>
      <p className={`text-18 ${accent ? "text-brand" : ""}`}>{value}</p>
    </div>
  );
}
