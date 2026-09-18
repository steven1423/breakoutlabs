import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SkinScan } from "@/components/skin-scan";
import { createServiceSupabase } from "@/lib/db/service";

export const metadata: Metadata = { title: "Skin scan" };
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

/**
 * The creator's own scan page: no rail, no persona, nothing but the consent, the camera and the result.
 * This is the link a creator receives when they agree to partner; the scan runs on their device.
 */
export default async function CreatorScanPage({ params }: Props) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const db = createServiceSupabase();
  const { data: creator, error } = await db.from("creators").select("id, handle, display_name, platform").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!creator) notFound();

  return (
    <main id="main" className="mx-auto max-w-5xl px-6 py-10">
      <header className="border-b border-line pb-6">
        <p className="text-13 text-muted">BreakoutLabs partner scan</p>
        <h1 className="font-display text-32">Skin scan for {creator.display_name || creator.handle}</h1>
        <p className="mt-2 max-w-3xl text-15 text-muted">
          A baseline on your own device before the kit ships, and the same scan again at the 90-day retest. The camera never leaves this page:
          your frames are analysed in this browser and thrown away, and only the counts below are saved, only if you press Save.
        </p>
      </header>
      <SkinScan subjectType="creator" subjectId={creator.id} subjectName={creator.display_name || creator.handle} />
      <p className="mt-10 text-13 text-muted">
        Not a diagnosis. The detector is a research model that finds roughly a third of visible lesions; it is a way to compare your own baseline with your own retest, nothing more.{" "}
        <Link href={`/growth/creators/${creator.id}?as=growth`} className="underline decoration-line underline-offset-4">Back to the creator page</Link>
      </p>
    </main>
  );
}
