/**
 * fetch for the Supabase client, with a deadline. Now and then a connection
 * to Supabase silently dies and the request just hangs — Node's default is
 * to wait ~300 s. In the app that froze the live board: Next runs one server
 * action at a time per client, so one hung save queued every swap/skip/LOG
 * behind it. With a deadline the request fails fast instead; reads (GET/HEAD,
 * safe to repeat) get one immediate retry, writes surface the error (the
 * live runner keeps the change and re-syncs it — see use-set-editor).
 *
 * The deadline covers the whole exchange — the body is read inside it (the
 * Supabase JSON bodies are small) so a stall mid-body is retried too.
 */
export const SUPABASE_TIMEOUT_MS = 10_000;

/** Statuses whose Response must have a null body. */
const NULL_BODY = new Set([101, 204, 205, 304]);

export function timeoutFetch(
  timeoutMs = SUPABASE_TIMEOUT_MS,
  // Looked up per call, not captured at module load: Next patches the global
  // fetch, and the Supabase client must go through the patched one.
  base: typeof fetch = (input, init) => fetch(input, init),
): typeof fetch {
  const once = async (input: Parameters<typeof fetch>[0], init: RequestInit | undefined, method: string) => {
    const deadline = AbortSignal.timeout(timeoutMs);
    const signal = init?.signal ? AbortSignal.any([init.signal, deadline]) : deadline;
    const res = await base(input, { ...init, signal });
    const body = method === "HEAD" || NULL_BODY.has(res.status) ? null : await res.arrayBuffer();
    return new Response(body, { status: res.status, statusText: res.statusText, headers: res.headers });
  };
  return async (input, init) => {
    const method = (init?.method ?? "GET").toUpperCase();
    const attempts = method === "GET" || method === "HEAD" ? 2 : 1;
    for (let attempt = 1; ; attempt++) {
      try {
        return await once(input, init, method);
      } catch (e) {
        const timedOut = e instanceof DOMException && e.name === "TimeoutError";
        if (!timedOut) throw e; // the caller's own abort, or a real network error
        if (attempt >= attempts || init?.signal?.aborted) {
          throw new Error(`Supabase didn't answer within ${timeoutMs / 1000}s — try again.`);
        }
      }
    }
  };
}
