"use client";

import { useActionState } from "react";
import { discoverAction, type DiscoverState } from "@/lib/growth/actions";

const initial: DiscoverState = { result: null, error: null };

/** Runs YouTube discovery and reports what it added and how much quota it used. */
export function DiscoverButton({ configured }: { configured: boolean }) {
  const [state, action, pending] = useActionState(discoverAction, initial);
  return (
    <form action={action} className="flex flex-wrap items-center gap-4">
      <button type="submit" disabled={pending || !configured} className="rounded-control bg-accent px-4 py-2 text-15 font-medium text-white disabled:opacity-60">
        {pending ? "Discovering" : "Discover on YouTube"}
      </button>
      {!configured ? <span className="text-15 text-muted">Not configured: YOUTUBE_API_KEY. Showing seeded creators.</span> : null}
      {state.error ? <span className="text-15 text-seeded">Discovery failed: {state.error}</span> : null}
      {state.result ? (
        <span className="text-15 text-muted">
          {state.result.channels} channels, {state.result.added} new, {state.result.updated} refreshed, {state.result.crossLinks} cross-links added.
          {" "}{state.result.searchCallsUsed} search calls used, {state.result.searchCallsRemaining} left today.
          {state.result.quotaExhausted ? " Quota ran out; the rest came from cache." : ""}
        </span>
      ) : null}
    </form>
  );
}
