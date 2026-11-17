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
/** Deliberately NOT `NEXT_PUBLIC_`-prefixed: the key never inlines into a
 *  browser bundle, even by an accidental client-side reference. */
export const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_PUBLISHABLE_KEY!,
  {
    auth: { persistSession: false },
    global: {
      fetch: (url, options) => fetch(url, { ...options, cache: "no-store" }),
    },
  },
);
