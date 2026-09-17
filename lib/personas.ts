/**
 * Personas re-skin navigation and copy. They never change data access (CLAUDE.md §2).
 * The active persona lives in the URL as `?as=support|growth|founder|brand`.
 */

export const PERSONAS = ["support", "growth", "founder", "brand"] as const;
export type Persona = (typeof PERSONAS)[number];
export const DEFAULT_PERSONA: Persona = "support";
export const PERSONA_PARAM = "as";

export type SectionKey = "ops" | "growth" | "intelligence";

/** A page in the rail. `persona` overrides the group's when the page belongs to someone else. */
export type NavLink = { href: string; label: string; persona?: Persona };
/** One group of the rail. `persona` is who the group belongs to; opening one of its links views the app as them. */
export type Section = { key: SectionKey; persona: Persona; label: string; links: NavLink[] };

/**
 * The rail, in the one order it is ever shown. Three groups named after the people who use them,
 * six pages named after what they show. The partner brand portal sits under Growth because that is
 * where the money comes from; its link still views the app as the brand persona.
 */
export const SECTIONS: readonly Section[] = [
  { key: "ops", persona: "support", label: "Support", links: [{ href: "/ops", label: "Kits and tickets" }] },
  {
    key: "growth",
    persona: "growth",
    label: "Growth",
    links: [
      { href: "/growth", label: "Creators" },
      { href: "/growth/allocator", label: "Ad budget split" },
      { href: "/brand", label: "Partner brand portal", persona: "brand" },
    ],
  },
  {
    key: "intelligence",
    persona: "founder",
    label: "Founder",
    links: [
      { href: "/intelligence", label: "Customer insights" },
      { href: "/model", label: "Valuation calculator" },
    ],
  },
];

export type PersonaMeta = { label: string; home: string; section: SectionKey };

export const PERSONA_META: Record<Persona, PersonaMeta> = {
  support: { label: "Support", home: "/ops", section: "ops" },
  growth: { label: "Growth", home: "/growth", section: "growth" },
  founder: { label: "Founder", home: "/intelligence", section: "intelligence" },
  brand: { label: "Partner brand", home: "/brand", section: "growth" },
};

export function isPersona(value: unknown): value is Persona {
  return typeof value === "string" && (PERSONAS as readonly string[]).includes(value);
}

/** Reads the persona from a query value. Anything unrecognised falls back to Support. */
export function parsePersona(value: string | string[] | null | undefined): Persona {
  const single = Array.isArray(value) ? value[0] : value;
  return isPersona(single) ? single : DEFAULT_PERSONA;
}

/** Adds `?as=persona` to an internal link so the persona survives navigation. */
export function withPersona(href: string, persona: Persona): string {
  if (!href.startsWith("/")) return href;
  const joiner = href.includes("?") ? "&" : "?";
  return `${href}${joiner}${PERSONA_PARAM}=${persona}`;
}
