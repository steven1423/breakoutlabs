import { createBrowserClient } from "@supabase/ssr";
import { readPublicEnv } from "../env.ts";

/** Supabase client for client components. Uses the publishable key; RLS applies. */
export function createBrowserSupabase() {
  const env = readPublicEnv();
  return createBrowserClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}
