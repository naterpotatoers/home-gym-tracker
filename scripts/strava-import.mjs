#!/usr/bin/env node
// One-off backfill from a Strava bulk export (Settings › My Account ›
// Download or Delete Your Account › Request Your Archive). Imports the runs
// in activities.csv for one client; hikes, walks, rides, etc. are skipped,
// matching the live sync (RUN_SPORTS in src/lib/strava.ts).
//
//   node scripts/strava-import.mjs <activities.csv> <clientId>           → dry run
//   node scripts/strava-import.mjs <activities.csv> <clientId> --write   → insert
//
// Rows key on external_id "strava:<activity id>" — the same key the live
// sync uses — so re-running (or syncing later) never duplicates; rows that
// already exist are left untouched. Never deletes anything.
//
// Needs NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in
// .env.local (or the env); NEXT_PUBLIC_GYM_TZ if the gym isn't in Los Angeles.

import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

try {
  process.loadEnvFile(".env.local");
} catch {
  // no .env.local — fall back to the process environment
}

const RUN_TYPES = new Set(["Run", "Trail Run", "Virtual Run"]);
const METERS_PER_MILE = 1609.344;
const FEET_PER_METER = 3.28084;
const GYM_TZ = process.env.NEXT_PUBLIC_GYM_TZ ?? "America/Los_Angeles";

const args = process.argv.slice(2);
const write = args.includes("--write");
const [csvPath, clientId] = args.filter((a) => !a.startsWith("--"));
if (!csvPath || !clientId) {
  console.error("Usage: node scripts/strava-import.mjs <activities.csv> <clientId> [--write]");
  process.exit(1);
}

const { NEXT_PUBLIC_SUPABASE_URL: url, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: key } = process.env;
if (!url || !key) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env.local.");
  process.exit(1);
}
const db = createClient(url, key);

/** RFC 4180-ish: quoted fields may hold commas, doubled quotes, newlines. */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.length > 1);
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "Nov 10, 2026, 11:24:21 PM" (UTC) → the gym-local yyyy-mm-dd. */
function localDate(activityDate) {
  const m = /^(\w{3}) (\d{1,2}), (\d{4}), (\d{1,2}):(\d{2}):(\d{2}) (AM|PM)$/.exec(activityDate.trim());
  if (!m) throw new Error(`Unrecognized Activity Date: "${activityDate}"`);
  const [, mon, day, year, h, min, sec, ampm] = m;
  const hour = (Number(h) % 12) + (ampm === "PM" ? 12 : 0);
  const month = MONTHS.indexOf(mon);
  if (month < 0) throw new Error(`Unrecognized month in "${activityDate}"`);
  const utc = new Date(Date.UTC(Number(year), month, Number(day), hour, Number(min), Number(sec)));
  return utc.toLocaleDateString("en-CA", { timeZone: GYM_TZ });
}

const num = (s) => (s === undefined || s.trim() === "" ? null : Number(s));
const flag = (s) => !!s && s.trim() !== "" && s.trim() !== "0" && s.trim().toLowerCase() !== "false";

const [header, ...records] = parseCsv(readFileSync(csvPath, "utf8"));
/** Column index by name; Strava repeats headers (Distance #1 is km, #2 meters). */
function col(name, occurrence = 1) {
  let seen = 0;
  for (let i = 0; i < header.length; i++) {
    if (header[i] === name && ++seen === occurrence) return i;
  }
  throw new Error(`Column "${name}" #${occurrence} not found — is this a Strava activities.csv?`);
}
const C = {
  id: col("Activity ID"),
  date: col("Activity Date"),
  name: col("Activity Name"),
  type: col("Activity Type"),
  description: col("Activity Description"),
  elapsed: col("Elapsed Time"),
  meters: col("Distance", 2),
  moving: col("Moving Time"),
  elevation: col("Elevation Gain"),
  heartRate: col("Average Heart Rate"),
  longRun: col("Long Run"),
  race: col("Competition"),
};

const skippedTypes = new Map();
let skippedEmpty = 0;
const runs = [];
for (const r of records) {
  const type = r[C.type];
  if (!RUN_TYPES.has(type)) {
    skippedTypes.set(type, (skippedTypes.get(type) ?? 0) + 1);
    continue;
  }
  const meters = num(r[C.meters]) ?? 0;
  const seconds = Math.round(num(r[C.moving]) || num(r[C.elapsed]) || 0);
  if (meters <= 0 || seconds <= 0) {
    skippedEmpty++;
    continue;
  }
  const elevation = num(r[C.elevation]);
  const heartRate = num(r[C.heartRate]);
  runs.push({
    id: `run_${randomUUID().replace(/-/g, "").slice(0, 8)}`,
    client_id: clientId,
    date: localDate(r[C.date]),
    distance_miles: Math.round((meters / METERS_PER_MILE) * 100) / 100,
    duration_seconds: seconds,
    kind: flag(r[C.race]) ? "race" : flag(r[C.longRun]) ? "long" : "easy",
    avg_heart_rate: heartRate ? Math.round(heartRate) : null,
    elevation_gain_ft: elevation === null ? null : Math.round(elevation * FEET_PER_METER),
    name: r[C.name].trim(),
    source: "strava",
    external_id: `strava:${r[C.id]}`,
    notes: (r[C.description] ?? "").trim(),
  });
}

const client = await db.from("clients").select("id, first_name").eq("id", clientId).maybeSingle();
if (client.error) throw new Error(`looking up client: ${client.error.message}`);
if (!client.data) {
  console.error(`No client "${clientId}" in the clients table.`);
  process.exit(1);
}

const existing = await db.from("runs").select("external_id, date, source").eq("client_id", clientId);
if (existing.error) throw new Error(`reading runs: ${existing.error.message}`);
const known = new Set(existing.data.map((r) => r.external_id).filter(Boolean));
const fresh = runs.filter((r) => !known.has(r.external_id));
const freshDates = new Set(fresh.map((r) => r.date));
const manualOverlaps = [
  ...new Set(existing.data.filter((r) => r.source === "manual" && freshDates.has(r.date)).map((r) => r.date)),
].sort();

const dates = runs.map((r) => r.date).sort();
const miles = (rs) => rs.reduce((sum, r) => sum + r.distance_miles, 0).toFixed(1);
const hms = (s) => {
  const h = Math.floor(s / 3600);
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const sec = String(s % 60).padStart(2, "0");
  return h > 0 ? `${h}:${m}:${sec}` : `${Number(m)}:${sec}`;
};

console.log(`Client:            ${client.data.first_name} (${clientId})`);
console.log(`Runs in export:    ${runs.length} (${miles(runs)} mi), ${dates[0]} → ${dates.at(-1)}`);
console.log(`Already imported:  ${runs.length - fresh.length}`);
console.log(`New:               ${fresh.length} (${miles(fresh)} mi)`);
console.log(
  `Skipped:           ${[...skippedTypes].map(([t, n]) => `${n} ${t}`).join(", ") || "none"}` +
    (skippedEmpty ? `; ${skippedEmpty} runs with no distance/time` : ""),
);
if (manualOverlaps.length > 0) {
  console.log(
    `\n⚠ Hand-logged runs already exist on ${manualOverlaps.length} of these dates — check for doubles:\n  ${manualOverlaps.join(", ")}`,
  );
}
console.log("\nNewest new runs:");
for (const r of [...fresh].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5)) {
  console.log(
    `  ${r.date}  ${String(r.distance_miles).padStart(5)} mi  ${hms(r.duration_seconds).padStart(7)}  HR ${r.avg_heart_rate ?? "—"}  ${r.name}`,
  );
}

if (!write) {
  console.log("\nDry run — nothing written. Re-run with --write to insert.");
  process.exit(0);
}
for (let i = 0; i < fresh.length; i += 100) {
  const { error } = await db.from("runs").insert(fresh.slice(i, i + 100));
  if (error) throw new Error(`inserting runs ${i}–${i + 99}: ${error.message}`);
}
console.log(`\nInserted ${fresh.length} runs.`);
