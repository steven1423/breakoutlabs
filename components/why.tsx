export type WhyStep = { title: string; body: string };

/**
 * What the page is for, in one strip under the header: the job, then the three things you do here.
 * Every page carries one so a first-time viewer never asks why a table exists.
 */
export function WhyThisPage({ job, steps }: { job: string; steps: WhyStep[] }) {
  return (
    <section aria-label="What this page is for" className="mt-6 grid gap-4 rounded-panel border border-line bg-surface p-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,2fr)]">
      <div>
        <p className="text-13 text-muted">What this page is for</p>
        <p className="mt-1 text-18">{job}</p>
      </div>
      <ol className="grid gap-4 sm:grid-cols-3">
        {steps.map((s, i) => (
          <li key={s.title} className="flex gap-3">
            <span aria-hidden="true" className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-line text-13 text-muted">{i + 1}</span>
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
