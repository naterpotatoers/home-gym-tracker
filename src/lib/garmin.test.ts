import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { fetchActivities } = await import("./garmin");

type Call = { url: string; auth: string | null };

/** A stand-in Garmin: the token endpoint returns `tokens` in turn; activity
 *  pages come from `pages` (or a status code to fail with). */
function fakeGarmin(pages: (unknown | number)[], tokens = ["t1", "t2"]) {
  const calls: Call[] = [];
  let page = 0;
  let token = 0;
  const http = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    const auth = new Headers(init?.headers).get("Authorization");
    calls.push({ url, auth });
    if (url.includes("/token")) return new Response(tokens[token++] ?? "tX");
    const next = pages[page++];
    if (typeof next === "number") return new Response("", { status: next });
    return new Response(JSON.stringify(next));
  }) as typeof fetch;
  return { http, calls };
}

const activity = (id: number) => ({ activityId: id, startTimeLocal: "2026-11-14 07:00:00" });
let keyN = 0;
const config = () => ({ apiKey: `key-${++keyN}`, athlete: "nate" });

describe("garmin fetchActivities", () => {
  it("trades the API key for a bearer token, then pages until a short page", async () => {
    const full = Array.from({ length: 100 }, (_, i) => activity(i));
    const { http, calls } = fakeGarmin([full, [activity(100)]]);
    const out = await fetchActivities(config(), "2026-11-01", "2026-11-16", http);
    expect(out).toHaveLength(101);
    expect(calls[0].auth).toMatch(/^ApiKey key-/);
    expect(calls[1].auth).toBe("Bearer t1");
    expect(calls[1].url).toContain("startDate=2026-11-01");
    expect(calls[2].url).toContain("start=100");
  });

  it("unwraps an {activityList} body", async () => {
    const { http } = fakeGarmin([{ activityList: [activity(1)] }]);
    expect(await fetchActivities(config(), "2026-11-01", "2026-11-16", http)).toHaveLength(1);
  });

  it("retries once with a fresh token on 401", async () => {
    const { http, calls } = fakeGarmin([401, [activity(1)]]);
    expect(await fetchActivities(config(), "2026-11-01", "2026-11-16", http)).toHaveLength(1);
    expect(calls.map((c) => c.auth)).toEqual([expect.stringMatching(/^ApiKey/), "Bearer t1", expect.stringMatching(/^ApiKey/), "Bearer t2"]);
  });

  it("explains an expired key and a rate limit", async () => {
    await expect(fetchActivities(config(), "a", "b", fakeGarmin([401, 401]).http)).rejects.toThrow(/expired/);
    await expect(fetchActivities(config(), "a", "b", fakeGarmin([429]).http)).rejects.toThrow(/rate limit/);
  });
});
