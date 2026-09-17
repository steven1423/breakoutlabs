import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types.ts";

export type ServiceClient = ReturnType<typeof createServiceSupabase>;

/**
 * Server-only client with the secret key. RLS is bypassed, so this is the staff read and write
 * path until accounts exist (docs/DECISIONS.md, M1). No Next imports, so scripts can use it too.
 * Never import from a client component.
 */
export function createServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing or invalid env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY");
  return createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
