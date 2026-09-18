import Link from "next/link";

export type SegmentOption = { key: string; label: string; count?: number; href: string };

/** A row of views, one selected. Links, not buttons, so the choice lives in the URL and survives refresh. */
export function Segmented({ options, active, label }: { options: SegmentOption[]; active: string; label: string }) {
  return (
    <nav aria-label={label} className="inline-flex flex-wrap rounded-control border border-line text-15">
      {options.map((o) => {
        const selected = o.key === active;
        return (
          <Link
            key={o.key}
            href={o.href}
            aria-current={selected ? "page" : undefined}
            className={`flex items-center gap-2 px-3 py-1.5 first:rounded-l-control last:rounded-r-control ${selected ? "bg-raised text-text" : "text-muted hover:text-text"}`}
          >
            {o.label}
            {o.count !== undefined ? <span className={`text-13 ${selected ? "text-muted" : ""}`}>{o.count.toLocaleString("en-US")}</span> : null}
          </Link>
        );
      })}
    </nav>
  );
}
