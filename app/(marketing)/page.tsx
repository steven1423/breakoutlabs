import Link from "next/link";

const THESIS = [
  "The retest is the asset.",
  "Every leak in the loop is data that never existed.",
  "This is the system that closes it.",
];

export default function LandingPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-12 px-6 py-16">
      {/* TODO(copy): M7 replaces this static ring with the loop drawing itself. */}
      <svg
        aria-hidden="true"
        width="220"
        height="220"
        viewBox="0 0 220 220"
        className="text-accent"
      >
        <circle cx="110" cy="110" r="96" fill="none" stroke="currentColor" strokeWidth="3" />
        <circle cx="110" cy="14" r="7" fill="currentColor" />
      </svg>

      <div className="max-w-2xl text-center font-display text-32">
        {THESIS.map((line) => (
          <p key={line}>{line}</p>
        ))}
      </div>

      <Link
        href="/ops?as=support"
        className="rounded-control bg-accent px-5 py-2.5 text-15 font-medium text-white"
      >
        Enter BreakoutOS
      </Link>
    </main>
  );
}
