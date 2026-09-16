import { z } from "zod";

/**
 * Environment access in one place.
 * Public Supabase vars are validated so a misconfigured deploy fails with a readable message.
 * Optional integrations are reported as configured or not, so pages can fall back to Seeded.
 */

const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
});

export type PublicEnv = z.infer<typeof publicSchema>;

export function readPublicEnv(): PublicEnv {
  // Literal property access is required so Next can inline these into the client bundle.
  const parsed = publicSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });
  if (!parsed.success) {
    const names = parsed.error.issues.map((issue) => issue.path.join(".")).join(", ");
    throw new Error(`Missing or invalid env: ${names}`);
  }
  return parsed.data;
}

export type Integration = "anthropic" | "youtube" | "meta" | "search";

const REQUIRED_KEYS: Record<Integration, string[]> = {
  anthropic: ["ANTHROPIC_API_KEY"],
  youtube: ["YOUTUBE_API_KEY"],
  meta: ["META_ACCESS_TOKEN", "META_IG_USER_ID"],
  search: ["SEARCH_API_KEY"],
};

/** True when every key the integration needs is present and non-empty. Server only. */
export function isConfigured(name: Integration): boolean {
  return REQUIRED_KEYS[name].every((key) => Boolean(process.env[key]));
}
