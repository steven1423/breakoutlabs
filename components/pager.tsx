import Link from "next/link";
import type { Page } from "@/lib/ui/paging";
import { withParams } from "@/lib/ui/paging";

type Props = { page: Page<unknown>; params: Record<string, string | string[] | undefined>; pathname: string; noun: string };

/** Previous / next links and "1 to 25 of 350". Server rendered; the page number is a query parameter. */
export function Pager({ page, params, pathname, noun }: Props) {
  if (page.total === 0) return null;
  const link = (n: number) => `${pathname}${withParams(params, { page: n === 1 ? null : n })}`;
  return (
    <nav aria-label={`${noun} pages`} className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-2 text-13 text-muted">
      <span>
        {page.from} to {page.to} of {page.total.toLocaleString("en-US")} {noun}
      </span>
      <span className="flex items-center gap-1">
        <PageLink href={link(page.page - 1)} disabled={page.page <= 1}>Previous</PageLink>
        <span className="px-2">Page {page.page} of {page.pages}</span>
        <PageLink href={link(page.page + 1)} disabled={page.page >= page.pages}>Next</PageLink>
      </span>
    </nav>
  );
}

function PageLink({ href, disabled, children }: { href: string; disabled: boolean; children: React.ReactNode }) {
  if (disabled) return <span aria-disabled="true" className="rounded-control border border-line px-3 py-1 opacity-50">{children}</span>;
  return <Link href={href} className="rounded-control border border-line px-3 py-1 text-text hover:bg-raised">{children}</Link>;
}
