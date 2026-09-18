"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { PERSONA_META, PERSONA_PARAM, SECTIONS, parsePersona, withPersona, type Persona } from "@/lib/personas";

/**
 * The left rail: six pages in three groups, always in the same order. Each group belongs to a
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

function RailView({ pathname, viewingAs }: { pathname: string; viewingAs: Persona }) {
  const current = currentHref(pathname);
  return (
    <div className="flex h-full flex-col gap-8 px-4 py-6">
      <Link href="/" className="flex flex-col gap-1 px-2">
        {/* The wordmark sits in the middle band of a square PNG on the rail's own teal, so a cover crop shows just the word. */}
        <span className="block h-14 w-full overflow-hidden">
          <Image src="/breakoutlabs-logo.png" alt="BreakoutLabs" width={500} height={500} className="h-full w-full object-cover object-center" priority />
        </span>
        <span className="text-13 text-on-rail/70">BreakoutOS, the internal operating system</span>
      </Link>

      <nav aria-label="Pages" className="flex flex-col">
        {SECTIONS.map((section, i) => (
          <div key={section.key} className={`flex flex-col gap-1 py-4 ${i > 0 ? "border-t border-on-rail/15" : ""}`}>
            <p className="px-2 pb-1 text-13 font-semibold">{section.label}</p>
            {section.links.map((link) => {
              const active = link.href === current;
              return (
                <Link
                  key={link.href}
                  href={withPersona(link.href, link.persona ?? section.persona)}
                  aria-current={active ? "page" : undefined}
                  className={`rounded-control px-2 py-1 text-15 ${
                    active ? "bg-on-rail/15 font-semibold" : "text-on-rail/75 hover:bg-on-rail/10 hover:text-on-rail"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <p className="mt-auto px-2 text-13 text-on-rail/70">
        Viewing as {PERSONA_META[viewingAs].label.toLowerCase()}
      </p>
    </div>
  );
}
