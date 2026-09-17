import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { readPublicEnv } from "../env.ts";

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

export { createServiceSupabase } from "./service";
