import "server-only";
import type { StravaActivity } from "./running";

/**
 * Strava read-only client for ONE athlete (Garmin → Strava → here). Garmin's
 * own API is business-only, so Strava is the bridge.
 *
 * Credentials live only in server env vars, never the database: the
 * database is readable with the publishable key, so an OAuth token stored
 * there would be readable by anyone holding it.
 *   STRAVA_CLIENT_ID / STRAVA_CLIENT_SECRET — from strava.com/settings/api
 *   STRAVA_REFRESH_TOKEN — from `node scripts/strava-auth.mjs` (activity:read_all)
 *   STRAVA_ATHLETE — the gym client id the runs belong to (e.g. "nate")
 */
export type StravaConfig = {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  athlete: string;
};

export function stravaConfig(): StravaConfig | null {
  const {
    STRAVA_CLIENT_ID: clientId,
    STRAVA_CLIENT_SECRET: clientSecret,
    STRAVA_REFRESH_TOKEN: refreshToken,
    STRAVA_ATHLETE: athlete,
  } = process.env;
  if (!clientId || !clientSecret || !refreshToken || !athlete) return null;
  return { clientId, clientSecret, refreshToken, athlete };
}

/** The gym client Strava runs belong to, or null when sync isn't set up. */
export function stravaAthlete(): string | null {
  return stravaConfig()?.athlete ?? null;
}

// Strava may rotate the refresh token on refresh; keep the newest one for
// this server instance's lifetime (the env var stays the bootstrap value).
let tokenCache: { accessToken: string; expiresAt: number; refreshToken: string } | null = null;

async function accessToken(config: StravaConfig): Promise<string> {
  const now = Date.now() / 1000;
  if (tokenCache && tokenCache.expiresAt - 60 > now) return tokenCache.accessToken;
  const res = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      grant_type: "refresh_token",
      refresh_token: tokenCache?.refreshToken ?? config.refreshToken,
    }),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(
      res.status === 400 || res.status === 401
        ? "Strava rejected the saved token — re-run `node scripts/strava-auth.mjs` and update STRAVA_REFRESH_TOKEN."
        : `Strava token refresh failed (${res.status}).`,
    );
  }
  const body = (await res.json()) as {
    access_token: string;
    expires_at: number;
    refresh_token: string;
  };
  tokenCache = {
    accessToken: body.access_token,
    expiresAt: body.expires_at,
    refreshToken: body.refresh_token,
  };
  return body.access_token;
}

const RUN_SPORTS = new Set(["Run", "TrailRun", "VirtualRun"]);

/** Every run activity started after `afterEpoch` (seconds). */
export async function fetchRunActivities(
  config: StravaConfig,
  afterEpoch: number,
): Promise<StravaActivity[]> {
  const token = await accessToken(config);
  const out: StravaActivity[] = [];
  for (let page = 1; page <= 10; page++) {
    const url = `https://www.strava.com/api/v3/athlete/activities?after=${Math.floor(afterEpoch)}&per_page=100&page=${page}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (res.status === 429) throw new Error("Strava rate limit hit — try again in 15 minutes.");
    if (!res.ok) throw new Error(`Strava activities request failed (${res.status}).`);
    const batch = (await res.json()) as StravaActivity[];
    out.push(...batch.filter((a) => RUN_SPORTS.has(a.sport_type)));
    if (batch.length < 100) break;
  }
  return out;
}
