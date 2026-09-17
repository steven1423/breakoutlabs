import { describe, expect, it } from "vitest";
import {
  DEFAULT_PERSONA,
  PERSONAS,
  PERSONA_META,
  SECTIONS,
  parsePersona,
  withPersona,
} from "@/lib/personas";

describe("parsePersona", () => {
  it("accepts each of the four personas", () => {
    for (const p of PERSONAS) expect(parsePersona(p)).toBe(p);
  });

  it("falls back to Support for anything else", () => {
    expect(parsePersona(undefined)).toBe(DEFAULT_PERSONA);
    expect(parsePersona(null)).toBe(DEFAULT_PERSONA);
    expect(parsePersona("")).toBe(DEFAULT_PERSONA);
    expect(parsePersona("admin")).toBe(DEFAULT_PERSONA);
    expect(parsePersona("Growth")).toBe(DEFAULT_PERSONA);
  });

  it("takes the first value when the query repeats the key", () => {
    expect(parsePersona(["founder", "brand"])).toBe("founder");
  });
});

describe("SECTIONS", () => {
  it("is one fixed list in which every persona owns at least one page", () => {
    const owners = SECTIONS.flatMap((s) => s.links.map((l) => l.persona ?? s.persona));
    for (const p of PERSONAS) expect(owners).toContain(p);
    expect(SECTIONS.map((s) => s.label)).toEqual(["Support", "Growth", "Founder"]);
  });

  it("points every persona home at a page that views the app as them", () => {
    for (const p of PERSONAS) {
      const link = SECTIONS.flatMap((s) => s.links.map((l) => ({ ...l, owner: l.persona ?? s.persona }))).find((l) => l.href === PERSONA_META[p].home);
      expect(link?.owner).toBe(p);
    }
  });
});

describe("withPersona", () => {
  it("appends the persona to internal links", () => {
    expect(withPersona("/ops", "growth")).toBe("/ops?as=growth");
  });

  it("uses & when the link already has a query", () => {
    expect(withPersona("/ops?state=resulted", "founder")).toBe("/ops?state=resulted&as=founder");
  });

  it("leaves external links alone", () => {
    expect(withPersona("https://breakoutlab.co", "brand")).toBe("https://breakoutlab.co");
  });
});
