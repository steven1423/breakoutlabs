import { afterEach, describe, expect, it, vi } from "vitest";
import { isConfigured, readPublicEnv } from "@/lib/env";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("readPublicEnv", () => {
  it("returns the public Supabase settings when both are set", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "sb_publishable_test");
    expect(readPublicEnv()).toEqual({
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "sb_publishable_test",
    });
  });

  it("names the missing variable in the error", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "sb_publishable_test");
    expect(() => readPublicEnv()).toThrow(/NEXT_PUBLIC_SUPABASE_URL/);
  });

  it("rejects a URL that is not a URL", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "not a url");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "sb_publishable_test");
    expect(() => readPublicEnv()).toThrow(/NEXT_PUBLIC_SUPABASE_URL/);
  });
});

describe("isConfigured", () => {
  it("is false when a required key is empty or absent", () => {
    vi.stubEnv("YOUTUBE_API_KEY", "");
    expect(isConfigured("youtube")).toBe(false);
    vi.stubEnv("META_ACCESS_TOKEN", "token");
    vi.stubEnv("META_IG_USER_ID", "");
    expect(isConfigured("meta")).toBe(false);
  });

  it("is true only when every required key is present", () => {
    vi.stubEnv("META_ACCESS_TOKEN", "token");
    vi.stubEnv("META_IG_USER_ID", "123");
    expect(isConfigured("meta")).toBe(true);
    vi.stubEnv("SEARCH_API_KEY", "key");
    expect(isConfigured("search")).toBe(true);
  });
});
