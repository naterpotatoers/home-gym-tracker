import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Server-only on purpose, even though the publishable key is browser-safe:
 * every read goes through the request snapshot and every write through a
 * server action, so there is exactly one data path to reason about.
 *
 * The no-store fetch wrapper defeats Next's fetch caching, which also makes
 * every page that awaits the snapshot request-time dynamic — correct now that
 * the data mutates.
 */
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  {
    auth: { persistSession: false },
    global: {
      fetch: (url, options) => fetch(url, { ...options, cache: "no-store" }),
    },
  },
);
