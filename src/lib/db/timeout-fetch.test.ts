import { describe, expect, it } from "vitest";
import { timeoutFetch } from "./timeout-fetch";

/** A fake fetch: hangs (until aborted) for the first `hangs` calls. */
function flaky(hangs: number) {
  let calls = 0;
  const fn = ((_input: unknown, init?: RequestInit) => {
    calls++;
    if (calls > hangs) return Promise.resolve(new Response("ok"));
    return new Promise<Response>((_, reject) => {
      init?.signal?.addEventListener("abort", () => reject(init.signal!.reason));
    });
  }) as typeof fetch;
  return { fn, calls: () => calls };
}

describe("timeoutFetch", () => {
  it("a read that hangs is retried once and succeeds", async () => {
    const base = flaky(1);
    const res = await timeoutFetch(20, base.fn)("https://x.test/rest/v1/t");
    expect(await res.text()).toBe("ok");
    expect(base.calls()).toBe(2);
  });

  it("a write that hangs fails fast with a readable error, not retried", async () => {
    const base = flaky(1);
    await expect(timeoutFetch(20, base.fn)("https://x.test/rpc", { method: "POST" })).rejects.toThrow(
      /didn't answer/,
    );
    expect(base.calls()).toBe(1);
  });

  it("a read that hangs twice gives up", async () => {
    const base = flaky(2);
    await expect(timeoutFetch(20, base.fn)("https://x.test/rest/v1/t")).rejects.toThrow(/didn't answer/);
  });

  it("a caller's own abort is not retried", async () => {
    const base = flaky(5);
    const controller = new AbortController();
    const pending = timeoutFetch(1000, base.fn)("https://x.test/rest/v1/t", { signal: controller.signal });
    controller.abort();
    await expect(pending).rejects.toBeDefined();
    expect(base.calls()).toBe(1);
  });
});

describe("timeoutFetch body + global lookup", () => {
  it("a body that stalls past the deadline is retried for reads", async () => {
    let calls = 0;
    const base = ((_input: unknown, init?: RequestInit) => {
      calls++;
      if (calls > 1) return Promise.resolve(new Response('{"ok":true}', { status: 200 }));
      // Headers arrive at once; the body never finishes.
      const body = new ReadableStream({
        start(controller) {
          init?.signal?.addEventListener("abort", () => controller.error(init.signal!.reason));
        },
      });
      return Promise.resolve(new Response(body, { status: 200 }));
    }) as typeof fetch;
    const res = await timeoutFetch(20, base)("https://x.test/rest/v1/t");
    expect(await res.json()).toEqual({ ok: true });
    expect(calls).toBe(2);
  });

  it("keeps status and headers, and a 204 stays body-less", async () => {
    const base = (() =>
      Promise.resolve(new Response(null, { status: 204, headers: { "content-range": "*/0" } }))) as typeof fetch;
    const res = await timeoutFetch(1000, base)("https://x.test/rest/v1/t", { method: "DELETE" });
    expect(res.status).toBe(204);
    expect(res.headers.get("content-range")).toBe("*/0");
  });

  it("uses the global fetch as it is at call time", async () => {
    const original = globalThis.fetch;
    const wrapped = timeoutFetch(1000);
    globalThis.fetch = (() => Promise.resolve(new Response("patched"))) as typeof fetch;
    try {
      expect(await (await wrapped("https://x.test/")).text()).toBe("patched");
    } finally {
      globalThis.fetch = original;
    }
  });
});
