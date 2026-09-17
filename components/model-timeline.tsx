import Link from "next/link";
import { withPersona, type Persona } from "@/lib/personas";

type Milestone = { year: string; title: string; body: string; links: { href: string; label: string }[] };

/** Year 1 / 2 / 3, each milestone pointing at the feature in the app that unlocks it (CLAUDE.md §11). */
const MILESTONES: Milestone[] = [
  {
    year: "Year 1",
    title: "Close the loop",
    body: "Every kit reaches results, every stuck kit gets caught, and creators are ranked by retests instead of followers.",
    links: [
      { href: "/ops", label: "Ops: the kit state machine" },
      { href: "/growth", label: "Growth: cost-per-retest leaderboard" },
    ],
  },
  {
    year: "Year 2",
    title: "Price for the retest",
    body: "Membership-first pricing makes the 90-day retest the default, and intervention outcomes start to accumulate against baselines.",
    links: [
      { href: "/model?plan=membership_first", label: "Model: switch to membership-first" },
      { href: "/intelligence", label: "Intelligence: intervention to marker delta" },
    ],
  },
  {
    year: "Year 3",
    title: "Rent access to segments",
    body: "Partner brands buy guarded aggregates by segment. Customer rows never leave the building.",
    links: [
      { href: "/brand", label: "Brand portal: simulated Year 3" },
      { href: "/intelligence", label: "Intelligence: guarded export" },
    ],
  },
];

export function ModelTimeline({ persona }: { persona: Persona }) {
  return (
    <ol className="mt-4 grid gap-4 md:grid-cols-3">
      {MILESTONES.map((m) => (
        <li key={m.year} className="rounded-panel border border-line bg-surface p-5">
          <p className="text-13 text-muted">{m.year}</p>
          <p className="font-display text-24">{m.title}</p>
          <p className="mt-2 text-15 text-muted">{m.body}</p>
          <ul className="mt-4 flex flex-col gap-1 text-15">
            {m.links.map((l) => (
              <li key={l.href + l.label}>
                <Link href={withPersona(l.href, persona)} className="underline decoration-line underline-offset-4 hover:decoration-text">{l.label}</Link>
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ol>
  );
}
