export type WhyStep = { title: string; body: string };

/**
 * What the page is for, directly under the headline and not in a box: the job in one sentence,
 * then the three things you do here. Every page carries one so a first-time viewer never asks
 * why a table exists.
 */
export function WhyThisPage({ job, steps }: { job: string; steps: WhyStep[] }) {
  return (
    <section aria-label="What this page is for" className="mt-5 grid gap-x-10 gap-y-3 border-b border-line pb-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,2fr)]">
      <p className="font-display text-24 leading-snug">{job}</p>
      <ol className="grid gap-x-6 gap-y-3 sm:grid-cols-3">
        {steps.map((s, i) => (
          <li key={s.title} className="flex gap-3">
            <span aria-hidden="true" className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-13 font-medium text-white">{i + 1}</span>
            <div>
              <p className="text-15">{s.title}</p>
              <p className="text-13 text-muted">{s.body}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
