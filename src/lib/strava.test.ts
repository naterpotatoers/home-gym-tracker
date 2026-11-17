import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { fetchRunActivities } = await import("./strava");

const config = { clientId: "1", clientSecret: "s", refreshToken: "r", athlete: "nate" };

describe("strava fetchRunActivities", () => {
  it("refreshes a token, pages until a short page, keeps runs only", async () => {
    const urls: string[] = [];
    const page = (n: number, sport: string) =>
      Array.from({ length: n }, (_, i) => ({ id: i, sport_type: i === 0 ? sport : "Run" }));
    const pages = [page(100, "Ride"), page(3, "TrailRun")];
    const http = (async (input: string | URL | Request) => {
      const url = String(input);
      urls.push(url);
      if (url.includes("oauth/token")) {
        return Response.json({ access_token: "a", expires_at: Date.now() / 1000 + 3600, refresh_token: "r2" });
      }
      return Response.json(pages.shift() ?? []);
    }) as typeof fetch;

    const runs = await fetchRunActivities(config, 1_700_000_000, http);
    expect(runs).toHaveLength(102); // the Ride is dropped, the TrailRun kept
    expect(urls[1]).toContain("after=1700000000");
    expect(urls[2]).toContain("page=2");
  });
});
