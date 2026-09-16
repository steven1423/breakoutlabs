import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DataBadge } from "@/components/badge";
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

export default async function CreatorPage({ params, searchParams }: Props) {
  const { id } = await params;
  const persona = parsePersona((await searchParams).as);
  const detail = await loadCreatorDetail(id);
  if (!detail) notFound();
  const { creator, card, campaigns, crossLinks } = detail;
  const band = priceBand(creator.followers ?? 0, creator.engagement_rate);
  const titles = Array.isArray(creator.recent_titles) ? (creator.recent_titles as string[]) : [];

  return (
    <>
      <PageHeader
        title={creator.display_name || creator.handle}
        caption={`${creator.platform}, ${creator.handle}. Produced by ${creator.source}.`}
        status={creator.data_status}
        reason={creator.enrich_error ?? (creator.data_status === "live" ? `Fetched ${creator.enriched_at?.slice(0, 10) ?? ""}` : "Metrics not fetched from an API")}
      />
      <p className="mt-4 text-15">
        <Link href={withPersona("/growth", persona)} className="underline decoration-line underline-offset-4">Back to creators</Link>
        <span className="mx-2 text-muted">·</span>
        <a href={creator.url} target="_blank" rel="noreferrer" className="underline decoration-line underline-offset-4">Open profile</a>
      </p>

      <section className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="Followers" value={formatCount(creator.followers)} />
        <Stat label="Engagement rate" value={creator.engagement_rate === null ? "–" : `${(creator.engagement_rate * 100).toFixed(1)}%`} />
        <Stat label="Average views" value={formatCount(creator.avg_views)} />
        <Stat label={`Price per post, ${band.tier} (estimate)`} value={`${formatUsd(band.low)} to ${formatUsd(band.high)}`} />
      </section>

      <section className="mt-8">
        <h2 className="text-24">About</h2>
        <p className="mt-2 whitespace-pre-line text-15 text-muted">{creator.bio || "No bio on file."}</p>
        {titles.length > 0 ? (
          <ul className="mt-4 list-disc pl-5 text-15">
            {titles.map((t, i) => <li key={i}>{t}</li>)}
          </ul>
        ) : null}
        <RefreshControls detail={detail} />
      </section>

      <section className="mt-8">
        <h2 className="text-24">Cross-links</h2>
        <p className="text-15 text-muted">Instagram and TikTok handles named in the bio. Rows for them start Seeded until an adapter enriches them.</p>
        {crossLinks.length === 0 ? <p className="mt-2 text-15 text-muted">None found.</p> : (
          <ul className="mt-2 text-15">
            {crossLinks.map(({ stub, creatorId }) => (
              <li key={`${stub.platform}:${stub.handle}`}>
                {stub.platform} {stub.handle}
                {creatorId ? <Link href={withPersona(`/growth/creators/${creatorId}`, persona)} className="ml-2 underline decoration-line underline-offset-4">row</Link> : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-8">
        <h2 className="text-24">Campaigns</h2>
        {campaigns.length === 0 ? <p className="mt-2 text-15 text-muted">No campaign yet. Campaign codes and spend are seeded for the demo.</p> : (
          <ul className="mt-2 divide-y divide-line rounded-panel border border-line text-15">
            {campaigns.map((c) => (
              <li key={c.campaignId} className="flex flex-wrap gap-x-6 gap-y-1 px-4 py-3">
                <span>Code {c.code}</span>
                <span className="text-muted">Spend {formatUsd(c.spend)}</span>
                <span className="text-muted">Orders {c.totals.orders}</span>
                <span className="text-muted">Retested {c.totals.retested} ({formatPercent(c.metrics.retestRate)})</span>
                <span>Cost per retest {formatUsd(c.metrics.costPerRetest)}</span>
                <span className="text-muted">CAC {formatUsd(c.metrics.cac)}</span>
                <span className="text-muted">LTV 90d {formatUsd(c.metrics.ltv90d)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-24">AI creator card</h2>
            <p className="text-15 text-muted">Fit, segment, angle and an outreach draft from the bio, metrics and recent titles. Price band is the tier rule, labelled estimate.</p>
          </div>
          {card ? <DataBadge status="live" reason={`${card.model}, ${card.generated_at.slice(0, 10)}`} /> : null}
        </div>
        {card ? <Card card={card} /> : <GenerateCard id={creator.id} />}
      </section>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-panel border border-line bg-surface px-4 py-3">
      <p className="text-13 text-muted">{label}</p>
      <p className="text-24">{value}</p>
    </div>
  );
}

function RefreshControls({ detail }: { detail: CreatorDetail }) {
  const { creator } = detail;
  if (creator.platform === "tiktok") return <p className="mt-4 text-15 text-muted">TikTok metrics: future adapter. Handle and titles only.</p>;
  const configured = creator.platform === "youtube" ? isConfigured("youtube") : isConfigured("meta");
  const missing = creator.platform === "youtube" ? "YOUTUBE_API_KEY" : "META_ACCESS_TOKEN, META_IG_USER_ID";
  return (
    <form action={enrichCreatorAction} className="mt-4 flex flex-wrap items-center gap-3">
      <input type="hidden" name="id" value={creator.id} />
      <button type="submit" disabled={!configured} className="rounded-control border border-line px-3 py-1.5 text-15 disabled:opacity-60">
        {creator.platform === "youtube" ? "Refresh from YouTube" : "Enrich from Instagram"}
      </button>
      {!configured ? <span className="text-15 text-muted">Not configured: {missing}</span> : null}
    </form>
  );
}

function GenerateCard({ id }: { id: string }) {
  const configured = isCopilotConfigured();
  return (
    <form action={generateCardAction} className="mt-4 flex flex-wrap items-center gap-3">
      <input type="hidden" name="id" value={id} />
      <button type="submit" disabled={!configured} className="rounded-control bg-accent px-4 py-2 text-15 font-medium text-white disabled:opacity-60">Generate card</button>
      <span className="text-15 text-muted">{configured ? `Uses ${copilotLabel()}.` : `Not configured: ${copilotKeyName()}.`}</span>
    </form>
  );
}

function Card({ card }: { card: NonNullable<CreatorDetail["card"]> }) {
  return (
    <div className="mt-4 grid gap-4 rounded-panel border border-line bg-surface p-5 text-15 md:grid-cols-[1fr_2fr]">
      <div className="flex flex-col gap-3">
        <Stat label="Fit score" value={`${card.fit_score} / 100`} />
        <Stat label="Predicted segment" value={card.predicted_segment} />
        <Stat label="Price per post (estimate)" value={`${formatUsd(card.price_band_low)} to ${formatUsd(card.price_band_high)}`} />
      </div>
      <div className="flex flex-col gap-4">
        <p>{card.summary}</p>
        <div>
          <p className="text-13 text-muted">Why</p>
          <p className="whitespace-pre-line">{card.fit_reasoning}</p>
        </div>
        <div>
          <p className="text-13 text-muted">Approach</p>
          <p>{card.approach_angle}</p>
        </div>
        <div>
          <p className="text-13 text-muted">Outreach draft</p>
          <p className="whitespace-pre-line">{card.outreach_draft}</p>
        </div>
      </div>
    </div>
  );
}
