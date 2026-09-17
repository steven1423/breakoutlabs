import Link from "next/link";

/** The 404 says what to try (CLAUDE.md §14). */
export default function NotFound() {
  return (
    <main id="main" className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="font-display text-32">Nothing at this address</h1>
      <p className="max-w-md text-15 text-muted">The page or record you asked for does not exist. Kit codes look like BL-4471-XK; creator and ticket links come from their tables.</p>
      <Link href="/ops?as=support" className="rounded-control bg-accent px-4 py-2 text-15 font-medium text-white">Go to Ops</Link>
    </main>
  );
}
