import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { Database } from "@/lib/db/types";
import { readPublicEnv } from "@/lib/env";

/**
 * Supabase client for server components, server actions and route handlers.
 * Importing `next/headers` makes this file fail loudly if it is ever pulled into a client bundle.
 */
export async function createServerSupabase() {
  const cookieStore = await cookies();
  const env = readPublicEnv();
  return createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Server components cannot set cookies; that is fine because personas are not accounts.
        }
      },
    },
  });
}

/**
 * Server-only client with the secret key. RLS is bypassed, so this is the staff read path
 * until accounts exist (docs/DECISIONS.md, M1). Never import from a client component.
 */
export function createServiceSupabase() {
  const url = readPublicEnv().NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("Missing or invalid env: SUPABASE_SERVICE_ROLE_KEY");
  return createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
