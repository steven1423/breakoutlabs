/**
 * Runs YouTube discovery once against the live API, upserts the creators as Live, and writes
 * lib/synthetic/youtube-snapshot.ts so `pnpm seed` can reproduce them as Seeded rows (CLAUDE.md §12).
 * Usage: pnpm discover [limit]   (needs YOUTUBE_API_KEY and the Supabase URL and secret key)
 */
import { writeFile } from "node:fs/promises";
import { createServiceSupabase } from "../lib/db/service.ts";
import { runDiscovery } from "../lib/creators/discover.ts";
import type { YoutubeSnapshotRow } from "../lib/synthetic/youtube-snapshot.ts";

const SNAPSHOT = "lib/synthetic/youtube-snapshot.ts";

async function main() {
  const limit = Number(process.argv[2] ?? 40);
  const db = createServiceSupabase();
  const result = await runDiscovery(limit, db);
  console.log(`channels ${result.channels}  added ${result.added}  updated ${result.updated}  cross-links ${result.crossLinks}  below the subscriber floor ${result.belowFloor}  search calls used ${result.searchCallsUsed}, ${result.searchCallsRemaining} left today${result.quotaExhausted ? " (quota ran out)" : ""}`);

  const { data, error } = await db.from("creators").select("handle, external_id, display_name, url, followers, engagement_rate, avg_views, bio, recent_titles").eq("platform", "youtube").in("handle", result.handles).order("followers", { ascending: false });
  if (error) throw new Error(error.message);
  const rows: YoutubeSnapshotRow[] = data.map((r) => ({
    handle: r.handle,
    external_id: r.external_id ?? "",
    display_name: r.display_name ?? "",
    url: r.url,
    followers: r.followers ?? 0,
    engagement_rate: r.engagement_rate,
    avg_views: r.avg_views,
    bio: r.bio ?? "",
    recent_titles: Array.isArray(r.recent_titles) ? (r.recent_titles as string[]) : [],
  }));
  await writeFile(SNAPSHOT, snapshotModule(rows));
  console.log(`wrote ${rows.length} rows to ${SNAPSHOT}`);
}

function snapshotModule(rows: YoutubeSnapshotRow[]): string {
  return `/**
 * Snapshot of the live YouTube pull (CLAUDE.md §12), written by \`pnpm discover\` on ${new Date().toISOString().slice(0, 10)}.
 * The seed loads these as Seeded rows; they flip to Live only when the running build re-fetches them.
 * Public professional-account data only. Do not edit by hand; re-run \`pnpm discover\`.
 */
export type YoutubeSnapshotRow = {
  handle: string;
  external_id: string;
  display_name: string;
  url: string;
  followers: number;
  engagement_rate: number | null;
  avg_views: number | null;
  bio: string;
  recent_titles: string[];
};

export const YOUTUBE_SNAPSHOT: YoutubeSnapshotRow[] = ${JSON.stringify(rows, null, 2)};
`;
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
