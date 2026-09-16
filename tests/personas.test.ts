import { describe, expect, it } from "vitest";
import {
  DEFAULT_PERSONA,
  PERSONAS,
  PERSONA_META,
  SECTIONS,
  navFor,
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

describe("navFor", () => {
  it("puts the persona's own section first and keeps every section", () => {
    for (const p of PERSONAS) {
      const nav = navFor(p);
      expect(nav[0].key).toBe(PERSONA_META[p].section);
      expect(nav.map((s) => s.key).sort()).toEqual(SECTIONS.map((s) => s.key).sort());
    }
  });

  it("points every persona home at a link in the rail", () => {
    const hrefs = SECTIONS.flatMap((s) => s.links.map((l) => l.href));
    for (const p of PERSONAS) expect(hrefs).toContain(PERSONA_META[p].home);
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
