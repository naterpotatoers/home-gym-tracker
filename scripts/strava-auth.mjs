#!/usr/bin/env node
// One-time Strava authorization → prints the STRAVA_REFRESH_TOKEN to paste
// into .env.local and Vercel. Run locally; the token never touches the app's
// database (anyone with the publishable key can read that).
//
//   1. node scripts/strava-auth.mjs            → prints a URL; open it, Authorize
//   2. the browser lands on http://localhost/?...&code=XXXX (the page itself
//      won't load — that's fine); copy the `code` value from the address bar
//   3. node scripts/strava-auth.mjs XXXX       → prints the refresh token
//
// Needs STRAVA_CLIENT_ID and STRAVA_CLIENT_SECRET in .env.local (or the env).

try {
  process.loadEnvFile(".env.local");
} catch {
  // no .env.local — fall back to the process environment
}

const { STRAVA_CLIENT_ID: id, STRAVA_CLIENT_SECRET: secret } = process.env;
if (!id || !secret) {
  console.error("Set STRAVA_CLIENT_ID and STRAVA_CLIENT_SECRET in .env.local first.");
  process.exit(1);
}

const code = process.argv[2];
if (!code) {
  const url = new URL("https://www.strava.com/oauth/authorize");
  url.searchParams.set("client_id", id);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", "http://localhost/exchange_token");
  url.searchParams.set("approval_prompt", "force");
  url.searchParams.set("scope", "activity:read_all");
  console.log("Open this, click Authorize, then copy `code` from the address bar:\n");
  console.log(url.toString());
  console.log("\nThen run: node scripts/strava-auth.mjs <code>");
  process.exit(0);
}

const res = await fetch("https://www.strava.com/oauth/token", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    client_id: id,
    client_secret: secret,
    code,
    grant_type: "authorization_code",
  }),
});
const body = await res.json();
if (!res.ok) {
  console.error("Strava refused the code (they expire fast and work once):", body);
  process.exit(1);
}
console.log(`Authorized as ${body.athlete?.firstname ?? "?"} ${body.athlete?.lastname ?? ""}.\n`);
console.log(`STRAVA_REFRESH_TOKEN=${body.refresh_token}`);
