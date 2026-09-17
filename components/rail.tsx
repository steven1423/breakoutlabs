"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { PERSONA_PARAM, SECTIONS, parsePersona, withPersona } from "@/lib/personas";

/**
 * The left rail: six pages in four groups, always in the same order. Each group belongs to a
 * persona, and opening one of its pages views the app as that persona, so there is no separate
 * switcher to keep in sync. It is the only client component in the shell because the persona is
 * read from the URL query, which a server layout cannot see. Wrap it in <Suspense>.
 */
export function Rail() {
  const pathname = usePathname();
  const persona = parsePersona(useSearchParams().get(PERSONA_PARAM));
  return <RailView pathname={pathname} viewingAs={persona} />;
}

/** Same markup before the client has read the URL. */
export function RailFallback() {
  return <RailView pathname="" viewingAs="support" />;
}

/** The link a path belongs to: the longest href that is the path or one of its ancestors, so /growth/allocator lights only Allocator. */
function currentHref(pathname: string): string | undefined {
  return SECTIONS.flatMap((s) => s.links)
    .filter((l) => pathname === l.href || pathname.startsWith(`${l.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;
}

function RailView({ pathname, viewingAs }: { pathname: string; viewingAs: string }) {
  const current = currentHref(pathname);
  return (
    <div className="flex h-full flex-col gap-8 px-4 py-6">
      <Link href="/" className="px-2 font-display text-18">
        BreakoutOS
      </Link>

      <nav aria-label="Pages" className="flex flex-col gap-5">
        {SECTIONS.map((section) => (
          <div key={section.key} className="flex flex-col gap-1">
            <p className="px-2 text-13 text-muted">{section.label}</p>
            {section.links.map((link) => {
              const active = link.href === current;
              return (
                <Link
                  key={link.href}
                  href={withPersona(link.href, section.persona)}
                  aria-current={active ? "page" : undefined}
                  className={`rounded-control px-2 py-1 text-15 ${
                    active ? "bg-raised text-text" : "text-muted hover:text-text"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <p className="mt-auto px-2 text-13 text-muted">
        Viewing as {SECTIONS.find((s) => s.persona === viewingAs)?.label.toLowerCase() ?? viewingAs}
      </p>
    </div>
  );
}
