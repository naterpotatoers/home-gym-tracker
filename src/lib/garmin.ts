import "server-only";
import type { GarminActivity } from "./running";

/**
 * Garmin Connect Personal API client for ONE athlete — free, self-serve
 * access to your own Garmin data (developer.garmin.com/gc-developer-program/personal).
 * Endpoints mirror Garmin's own SDK: github.com/garmin/connect-personal-api-python.
 *
 * Credentials live only in server env vars, never the database: the
 * database is readable with the publishable key.
 *   GARMIN_API_KEY — created at connect.garmin.com/app/settings/personalApiToken
 *     (shown once; expires after the 30/90/180/365 days you pick)
 *   GARMIN_ATHLETE — the gym client id the runs belong to (e.g. "nate")
 */
export type GarminConfig = { apiKey: string; athlete: string };

const BASE_URL = "https://personal.connectapi.garmin.com";
const TOKEN_PATH = "/personalapitoken-service/personal-api/personal-api-key/token";
const ACTIVITIES_PATH = "/activitylist-service/activities/search/activities";
const PAGE_SIZE = 100;
const EXPIRED_KEY =
  "Garmin rejected the API key — it has probably expired. Create a new one at connect.garmin.com/app/settings/personalApiToken and update GARMIN_API_KEY.";

export function garminConfig(): GarminConfig | null {
  const { GARMIN_API_KEY: apiKey, GARMIN_ATHLETE: athlete } = process.env;
  if (!apiKey?.trim() || !athlete?.trim()) return null;
  return { apiKey: apiKey.trim(), athlete: athlete.trim() };
}

/** The gym client Garmin runs belong to, or null when sync isn't set up. */
export function garminAthlete(): string | null {
  return garminConfig()?.athlete ?? null;
}

// The key trades for a 24h bearer JWT (no refresh tokens — just ask again).
// Cache it for this server instance's lifetime, keyed to the API key.
let tokenCache: { apiKey: string; token: string; expiresAt: number } | null = null;

function jwtExpiry(token: string): number {
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8"));
    if (typeof payload.exp === "number") return payload.exp;
  } catch {
    // not a JWT we can read — fall through to a conservative lifetime
  }
  return Date.now() / 1000 + 3600;
}

async function bearer(config: GarminConfig, force = false): Promise<string> {
  const now = Date.now() / 1000;
  if (!force && tokenCache?.apiKey === config.apiKey && tokenCache.expiresAt - 300 > now) {
    return tokenCache.token;
  }
  const res = await fetch(`${BASE_URL}${TOKEN_PATH}`, {
    method: "POST",
    headers: { Accept: "*/*", Authorization: `ApiKey ${config.apiKey}` },
    cache: "no-store",
  });
  if (res.status === 401 || res.status === 403) throw new Error(EXPIRED_KEY);
  if (!res.ok) throw new Error(`Garmin token request failed (${res.status}).`);
  const token = (await res.text()).trim();
  tokenCache = { apiKey: config.apiKey, token, expiresAt: jwtExpiry(token) };
  return token;
}

async function getJson(config: GarminConfig, path: string): Promise<unknown> {
  for (const force of [false, true]) {
    const token = await bearer(config, force);
    const res = await fetch(`${BASE_URL}${path}`, {
      headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    // A token can die before its exp — retry once with a fresh one.
    if (res.status === 401 && !force) continue;
    if (res.status === 401 || res.status === 403) throw new Error(EXPIRED_KEY);
    if (res.status === 429) throw new Error("Garmin rate limit hit — try again in a few minutes.");
    if (!res.ok) throw new Error(`Garmin activities request failed (${res.status}).`);
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  }
  throw new Error(EXPIRED_KEY);
}

/** Every activity (all sports) started between the two local dates, inclusive. */
export async function fetchActivities(
  config: GarminConfig,
  startDate: string,
  endDate: string,
): Promise<GarminActivity[]> {
  const out: GarminActivity[] = [];
  for (let page = 0; page < 10; page++) {
    const params = new URLSearchParams({
      start: String(page * PAGE_SIZE),
      limit: String(PAGE_SIZE),
      startDate,
      endDate,
    });
    const body = await getJson(config, `${ACTIVITIES_PATH}?${params}`);
    const batch: GarminActivity[] = Array.isArray(body)
      ? body
      : ((body as { activityList?: GarminActivity[] } | null)?.activityList ?? []);
    out.push(...batch);
    if (batch.length < PAGE_SIZE) break;
  }
  return out;
}
