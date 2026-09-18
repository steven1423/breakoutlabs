import Link from "next/link";
import { Loop } from "@/components/loop";

const THESIS = [
  "The retest is the asset.",
  "Every leak in the loop is data that never existed.",
  "This is the system that closes it.",
];

/** The one orchestrated moment (CLAUDE.md §14): the loop draws itself, the thesis appears, then Enter. */
export default function LandingPage() {
  return (
    <main id="main" className="flex min-h-screen flex-col items-center justify-center gap-12 px-6 py-16">
      <Loop />
      <div className="max-w-2xl text-center font-display text-32">
        {THESIS.map((line, i) => (
          <p key={line} className="thesis-line" style={{ ["--i" as string]: i }}>{line}</p>
        ))}
      </div>
      <Link href="/ops?as=support" className="thesis-enter rounded-control bg-lime px-6 py-3 text-18 font-bold text-on-lime">
        Enter BreakoutOS
      </Link>
      <p className="text-13 text-muted">Synthetic customers throughout. Every view says whether its numbers are live or seeded.</p>
    </main>
  );
}
