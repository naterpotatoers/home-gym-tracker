import "server-only";
import { createClient } from "@supabase/supabase-js";
import { timeoutFetch } from "./timeout-fetch";

/**
 * Server-only on purpose, even though the publishable key is browser-safe:
 * every read goes through the request snapshot and every write through a
 * server action, so there is exactly one data path to reason about.
 *
 * The no-store fetch wrapper defeats Next's fetch caching, which also makes
 * every page that awaits the snapshot request-time dynamic — correct now that
 * the data mutates. timeoutFetch puts a deadline on every request — a dead
 * connection otherwise hangs ~5 min and freezes the live board.
 */
const withDeadline = timeoutFetch();

/** Deliberately NOT `NEXT_PUBLIC_`-prefixed: the key never inlines into a
 *  browser bundle, even by an accidental client-side reference. */
export const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_PUBLISHABLE_KEY!,
  {
    auth: { persistSession: false },
    global: {
      fetch: (url, options) => withDeadline(url, { ...options, cache: "no-store" }),
    },
  },
);
