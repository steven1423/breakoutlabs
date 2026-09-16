export type DataStatus = "live" | "seeded";

const LABEL: Record<DataStatus, string> = { live: "Live", seeded: "Seeded" };
const TONE: Record<DataStatus, string> = {
  live: "border-live text-live",
  seeded: "border-seeded text-seeded",
};

/**
 * Honesty label (CLAUDE.md §1). Live means a real external API or real database logic;
 * Seeded means synthetic data. `reason` explains a fallback, e.g. "Not configured, showing seeded data".
 */
export function DataBadge({ status, reason }: { status: DataStatus; reason?: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-13">
      <span
        data-status={status}
        className={`rounded-control border px-2 py-0.5 font-medium leading-none ${TONE[status]}`}
      >
        {LABEL[status]}
      </span>
      {reason ? <span className="text-muted">{reason}</span> : null}
    </span>
  );
}
