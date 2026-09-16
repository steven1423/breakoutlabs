"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  PERSONAS,
  PERSONA_META,
  PERSONA_PARAM,
  SECTIONS,
  navFor,
  parsePersona,
  withPersona,
  type Persona,
  type Section,
} from "@/lib/personas";

/**
 * The left rail. It is the only client component in the shell because the persona is read
 * from the URL query, which a server layout cannot see. Wrap it in <Suspense>.
 */
export function Rail() {
  const pathname = usePathname();
  const persona = parsePersona(useSearchParams().get(PERSONA_PARAM));
  return <RailView persona={persona} pathname={pathname} sections={navFor(persona)} />;
}

/** Same markup with default persona. Shown while the client reads the URL. */
export function RailFallback() {
  return <RailView persona="support" pathname="" sections={[...SECTIONS]} />;
}

type ViewProps = { persona: Persona; pathname: string; sections: Section[] };

function RailView({ persona, pathname, sections }: ViewProps) {
  return (
    <div className="flex h-full flex-col gap-8 px-4 py-6">
      <Link href="/" className="px-2 font-display text-18">
        BreakoutOS
      </Link>

      <nav aria-label="Persona" className="flex flex-col gap-1">
        <p className="px-2 text-13 text-muted">Viewing as</p>
        {PERSONAS.map((p) => (
          <Link
            key={p}
            href={withPersona(pathname || PERSONA_META[p].home, p)}
            aria-current={p === persona ? "true" : undefined}
            className={`rounded-control px-2 py-1 text-15 ${
              p === persona ? "bg-raised text-text" : "text-muted hover:text-text"
            }`}
          >
            {PERSONA_META[p].label}
          </Link>
        ))}
      </nav>

      <nav aria-label="Sections" className="flex flex-col gap-6">
        {sections.map((section) => (
          <div key={section.key} className="flex flex-col gap-1">
            <p className="px-2 text-13 text-muted">{section.label}</p>
            {section.links.map((link) => {
              const active = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={withPersona(link.href, persona)}
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
    </div>
  );
}
