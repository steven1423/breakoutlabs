"use server";

import { revalidatePath } from "next/cache";
import { runAllocator, type AllocatorRun } from "@/lib/allocator/db";
import { createProvider } from "@/lib/copilot";
import { generateCreatorCard } from "@/lib/creators/card";
import { enrichCreator, runDiscovery, type DiscoveryResult } from "@/lib/creators/discover";
import { createServiceSupabase } from "@/lib/db/service";

export type DiscoverState = { result: DiscoveryResult | null; error: string | null };

/** Behind the Discover button. Runs the seven §8.2 queries through the cache and the quota counter. */
export async function discoverAction(): Promise<DiscoverState> {
  try {
    const result = await runDiscovery(40);
    revalidatePath("/growth");
    return { result, error: null };
  } catch (err) {
    return { result: null, error: err instanceof Error ? err.message : "Discovery failed" };
  }
}

export async function enrichCreatorAction(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  await enrichCreator(id);
  revalidatePath(`/growth/creators/${id}`);
  revalidatePath("/growth");
}

export async function generateCardAction(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  await generateCreatorCard(createServiceSupabase(), createProvider(), id);
  revalidatePath(`/growth/creators/${id}`);
  revalidatePath("/growth");
}

export type AllocatorState = { run: AllocatorRun | null; error: string | null };

export async function runAllocatorAction(_prev: AllocatorState, formData: FormData): Promise<AllocatorState> {
  try {
    const budget = Number(formData.get("budget"));
    const run = await runAllocator(budget);
    revalidatePath("/growth/allocator");
    return { run, error: null };
  } catch (err) {
    return { run: null, error: err instanceof Error ? err.message : "Allocator failed" };
  }
}
