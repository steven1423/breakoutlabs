"use client";

/** The app shell's error boundary: says what failed and what to try (CLAUDE.md §14). */
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="rounded-panel border border-line bg-surface px-6 py-10 text-center">
      <p className="text-18 font-medium">This page failed to render</p>
      <p className="mt-2 text-15 text-muted">{error.message || "An unexpected error occurred."} Check the Supabase env vars, then try again.</p>
      <button type="button" onClick={reset} className="mt-4 rounded-control bg-brand px-4 py-2 text-15 font-medium text-on-brand">Try again</button>
    </div>
  );
}
