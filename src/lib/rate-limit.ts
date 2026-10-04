import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Fixed-window limiter stored in Postgres so it holds across serverless instances.
 * Returns true when the request is allowed. Fails open if the database is unreachable
 * so a Supabase hiccup never takes the whole site down.
 */
export async function rateLimit(key: string, max: number, windowSeconds: number): Promise<boolean> {
  try {
    const { data, error } = await createAdminClient().rpc("hit_rate_limit", {
      p_key: key,
      p_window_seconds: windowSeconds,
      p_max: max,
    });
    if (error) return true;
    return data === true;
  } catch {
    return true;
  }
}
