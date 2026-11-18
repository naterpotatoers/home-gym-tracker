#!/usr/bin/env node
// Read-only digest of the live gym for the program-review skill: people,
// programs, routines, prescribed muscle coverage (the app's own math), and
// what each person ACTUALLY did — adherence, logged coverage, lift trends,
// pain notes, runs. Prints markdown to stdout. Never writes anything.
//
//   node --no-warnings .claude/skills/program-review/scripts/gym-digest.mjs
//     [--client <id>]      only this person (and the programs they touch)
//     [--program <id>]     only this program (and the people on it)
//     [--weeks 16]         look-back window for the "actual" sections
//     [--today YYYY-MM-DD] pretend it's this date (default: today, gym TZ)
//     [--draft <file.json>] check a proposed design instead (format below,
//                           at "Draft mode"); exits 2 if a row isn't buildable
//
// Coverage reproduces src/lib/modality.ts effectiveScores (modality deltas
// adjust, never introduce, clamped 0-10; mobility/conditioning excluded) and
// src/lib/coverage.ts prescribedCoverage/coverageStatus (sets × score/10;
// <2 weighted sets or peak <5 = neglected, <6 = light, else solid). Keep the
// two in sync if those change.
//
// Needs SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY in .env.local. Reference
// data (muscles, modalities, equipment) is imported straight from the TS
// sources via Node's built-in type stripping (Node 22.18+/24).

import { createClient } from "@supabase/supabase-js";

const ROOT = new URL("../../../../", import.meta.url);
try {
  process.loadEnvFile(new URL(".env.local", ROOT));
} catch {
  // no .env.local — fall back to the process environment
}

const { muscles, muscleGroups } = await import(new URL("src/lib/data/muscles.ts", ROOT).href);
const { modalities } = await import(new URL("src/lib/data/modalities.ts", ROOT).href);
const { bandById, hipBandRank } = await import(new URL("src/lib/data/equipment.ts", ROOT).href);

// ---------------------------------------------------------------------------
// Args
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : fallback;
};
const GYM_TZ = process.env.NEXT_PUBLIC_GYM_TZ ?? "America/Los_Angeles";
const onlyClient = opt("client", null);
const onlyProgram = opt("program", null);
const WEEKS = Math.max(1, Number(opt("weeks", "16")) || 16);
const TODAY = opt("today", new Intl.DateTimeFormat("en-CA", { timeZone: GYM_TZ }).format(new Date()));

const { SUPABASE_URL: url, SUPABASE_PUBLISHABLE_KEY: key } = process.env;
if (!url || !key) {
  console.error("Set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY in .env.local.");
  process.exit(1);
}
const db = createClient(url, key);

// ---------------------------------------------------------------------------
// Fetch (GET only, paged past PostgREST's 1000-row cap)
// ---------------------------------------------------------------------------

async function all(table, orderBy) {
  const out = [];
  for (let from = 0; ; from += 1000) {
    let q = db.from(table).select("*");
    for (const col of orderBy) q = q.order(col, { ascending: true });
    const { data, error } = await q.range(from, from + 999);
    if (error) {
      if (/does not exist|schema cache|relation/i.test(error.message)) return null;
      throw new Error(`${table}: ${error.message}`);
    }
    out.push(...data);
    if (data.length < 1000) return out;
  }
}

const [
  clients, weighIns, programs, programDays, routines, routineRows,
  assignments, sessions, setLogs, exercises, scoreRows, variantRows, runs,
] = await Promise.all([
  all("clients", ["id"]),
  all("weigh_ins", ["id"]),
  all("programs", ["id"]),
  all("program_days", ["program_id", "week", "day_of_week"]),
  all("routines", ["id"]),
  all("routine_exercises", ["routine_id", "sort_order"]),
  all("assignments", ["id"]),
  all("sessions", ["id"]),
  all("set_logs", ["id"]),
  all("exercises", ["id"]),
  all("exercise_muscle_scores", ["exercise_id", "muscle_id"]),
  all("exercise_modalities", ["exercise_id", "modality_id"]),
  all("runs", ["id"]),
]);
if (!clients || !programs || !routines || !routineRows || !sessions || !setLogs) {
  console.error("Core tables are missing — run supabase/schema.sql first (the app is on its TS seed).");
  process.exit(1);
}
if (!exercises || !scoreRows) {
  console.error("Exercise catalog tables are missing — import the seed catalog at /exercises first.");
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Lookups
// ---------------------------------------------------------------------------

const by = (rows, k) => new Map(rows.map((r) => [r[k], r]));
const groupBy = (rows, f) => {
  const m = new Map();
  for (const r of rows) {
    const k = f(r);
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(r);
  }
  return m;
};
const clientById = by(clients, "id");
const programById = by(programs, "id");
const routineById = by(routines, "id");
const exerciseById = by(exercises, "id");
const modalityById = by(modalities, "id");
const muscleName = new Map(muscles.map((m) => [m.id, m.name]));
const rowsByRoutine = groupBy(routineRows, (r) => r.routine_id);
for (const rows of rowsByRoutine.values()) rows.sort((a, b) => a.sort_order - b.sort_order);
const logsBySession = groupBy(setLogs, (l) => l.session_id);
const scoresByExercise = new Map();
for (const s of scoreRows) {
  if (!scoresByExercise.has(s.exercise_id)) scoresByExercise.set(s.exercise_id, new Map());
  scoresByExercise.get(s.exercise_id).set(s.muscle_id, s.score);
}
const variantKeys = new Set((variantRows ?? []).map((v) => `${v.exercise_id}|${v.modality_id}`));
const exName = (id) => exerciseById.get(id)?.name ?? id;
const routineName = (id) => routineById.get(id)?.name ?? id ?? "(no routine)";
const firstName = (id) => clientById.get(id)?.first_name ?? id;

// ---------------------------------------------------------------------------
// The app's coverage math (see header)
// ---------------------------------------------------------------------------

const isStrengthPattern = (p) => p !== "mobility" && p !== "conditioning";

function effectiveScores(exerciseId, modalityId) {
  const out = new Map();
  const ex = exerciseById.get(exerciseId);
  if (!ex || !isStrengthPattern(ex.pattern)) return out;
  for (const [m, s] of scoresByExercise.get(exerciseId) ?? []) out.set(m, s);
  for (const mod of modalityById.get(modalityId)?.muscleModifiers ?? []) {
    const base = out.get(mod.muscleId);
    if (base === undefined) continue; // adjust only, never introduce
    out.set(mod.muscleId, Math.min(10, Math.max(0, base + mod.delta)));
  }
  return out;
}

/** items: [{exerciseId, modalityId, sets}] → Map muscle → {weightedSets, peak} */
function coverage(items) {
  const out = new Map(muscles.map((m) => [m.id, { weightedSets: 0, peak: 0 }]));
  for (const it of items) {
    for (const [m, score] of effectiveScores(it.exerciseId, it.modalityId)) {
      const e = out.get(m);
      if (!e || score <= 0) continue;
      e.weightedSets += it.sets * (score / 10);
      e.peak = Math.max(e.peak, score);
    }
  }
  return out;
}

function status({ weightedSets, peak }) {
  if (weightedSets < 2 || peak < 5) return "neglected";
  if (weightedSets < 6) return "light";
  return "solid";
}

function coverageLines(cov, scale = 1) {
  const lines = [];
  for (const g of [...muscleGroups].sort((a, b) => a.order - b.order)) {
    const cells = muscles
      .filter((m) => m.groupId === g.id)
      .map((m) => {
        const c = cov.get(m.id);
        const scaled = { weightedSets: c.weightedSets * scale, peak: c.peak };
        return `${shortMuscle(m.id)} ${scaled.weightedSets.toFixed(1)} ${status(scaled)}`;
      });
    lines.push(`  - ${g.label}: ${cells.join(" · ")}`);
  }
  return lines;
}

function shortMuscle(id) {
  return (muscleName.get(id) ?? id).replace(/\s*\(.*\)$/, "");
}

const PATTERNS = ["squat", "hinge", "lunge", "push_h", "push_v", "pull_h", "pull_v", "core", "carry", "isolation", "mobility", "conditioning"];

function patternLine(items) {
  const sets = Object.fromEntries(PATTERNS.map((p) => [p, 0]));
  for (const it of items) {
    const p = exerciseById.get(it.exerciseId)?.pattern;
    if (p in sets) sets[p] += it.sets;
  }
  const push = sets.push_h + sets.push_v;
  const pull = sets.pull_h + sets.pull_v;
  return `  - Pattern sets: ${PATTERNS.map((p) => `${p} ${sets[p]}`).join(" · ")} — push:pull ${push}:${pull} (H ${sets.push_h}:${sets.pull_h}, V ${sets.push_v}:${sets.pull_v})`;
}

// ---------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------

const dayNum = (iso) => Math.floor(Date.parse(`${iso.slice(0, 10)}T00:00:00Z`) / 86400000);
const isoFromDay = (n) => new Date(n * 86400000).toISOString().slice(0, 10);
const DOW = ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
/** Monday-start week key, e.g. "11-09" (the Monday's month-day). */
function weekKey(iso) {
  const n = dayNum(iso);
  const dow = ((n + 3) % 7) + 1; // 1970-01-01 was a Thursday → Mon=1
  return isoFromDay(n - (dow - 1));
}
function ageOn(dob, iso) {
  if (!dob) return null;
  const [y, m, d] = dob.split("-").map(Number);
  const [ty, tm, td] = iso.split("-").map(Number);
  return ty - y - (tm < m || (tm === m && td < d) ? 1 : 0);
}
const windowStart = isoFromDay(dayNum(weekKey(TODAY)) - (WEEKS - 1) * 7);
const windowWeeks = Array.from({ length: WEEKS }, (_, i) => isoFromDay(dayNum(windowStart) + i * 7));

// ---------------------------------------------------------------------------
// Formatting a routine
// ---------------------------------------------------------------------------

function prescription(r) {
  const sets = r.sets ?? 1;
  let dose;
  if (r.duration_seconds) dose = `${sets}×${r.duration_seconds}s`;
  else if (r.rep_min != null || r.rep_max != null) {
    const lo = r.rep_min ?? r.rep_max;
    const hi = r.rep_max ?? r.rep_min;
    dose = `${sets}×${lo === hi ? lo : `${lo}–${hi}`}`;
  } else dose = `${sets} sets`;
  const bits = [dose, `rest ${r.rest_seconds ?? 0}s`];
  if (r.target_rir != null) bits.push(`RIR ${r.target_rir}`);
  if (r.unilateral_mode && r.unilateral_mode !== "bilateral") bits.push(r.unilateral_mode.replace("_", "-"));
  if (r.band_role) bits.push(`band ${r.band_role}`);
  if (r.superset_group) bits.push(`[SS ${r.superset_group}]`);
  if (r.interval_scheme || r.target_watts || r.target_rpm) {
    bits.push(`conditioning ${[r.interval_scheme, r.target_watts && `${r.target_watts}W`, r.target_rpm && `${r.target_rpm}rpm`].filter(Boolean).join(" ")}`);
  }
  return bits.join(" · ");
}

function workSeconds(r) {
  const base = r.duration_seconds ?? (r.rep_max ?? r.rep_min ?? 10) * 4;
  return r.unilateral_mode === "single_side" ? base * 2 : base;
}

/** Rough session length: supersets run as rounds (each member's work, then
 *  the longest rest); ~1 min setup per exercise. An estimate, not a timer. */
function estMinutes(rows) {
  let secs = 0;
  for (let i = 0; i < rows.length; ) {
    const g = rows[i].superset_group;
    let j = i + 1;
    if (g) while (j < rows.length && rows[j].superset_group === g) j++;
    const block = rows.slice(i, j);
    const rounds = Math.max(...block.map((r) => r.sets ?? 1));
    const work = block.reduce((a, r) => a + workSeconds(r), 0);
    const rest = Math.max(...block.map((r) => r.rest_seconds ?? 0));
    secs += rounds * work + Math.max(0, rounds - 1) * rest + block.length * 60;
    i = j;
  }
  return Math.round(secs / 60);
}

const items = (rows) => rows.map((r) => ({ exerciseId: r.exercise_id, modalityId: r.modality_id, sets: r.sets ?? 1 }));

function printRoutine(id, out) {
  const r = routineById.get(id);
  printRows(`${r?.name ?? id} (\`${id}\`)`, r?.notes, rowsByRoutine.get(id) ?? [], out);
}

function printRows(title, notes, rows, out) {
  const working = rows
    .filter((x) => isStrengthPattern(exerciseById.get(x.exercise_id)?.pattern))
    .reduce((a, x) => a + (x.sets ?? 1), 0);
  out.push(`### Routine: ${title}`);
  if (notes) out.push(`_${notes}_`);
  out.push(`- ${rows.length} exercises · ${working} working sets · est. ~${estMinutes(rows)} min`);
  rows.forEach((x, i) => {
    const pattern = exerciseById.get(x.exercise_id)?.pattern ?? "NOT IN CATALOG";
    out.push(`  ${i + 1}. ${exName(x.exercise_id)} (\`${x.exercise_id}\`, ${x.modality_id}, ${pattern}) — ${prescription(x)}${x.notes ? ` — "${x.notes}"` : ""}`);
  });
  const it = items(rows);
  out.push("- Coverage (weighted sets this session):");
  out.push(...coverageLines(coverage(it)));
  out.push(patternLine(it));
  out.push("");
}

// ---------------------------------------------------------------------------
// Draft mode: check a proposed design with the same math before building it.
//   { "routines": [{ "name": "...", "notes": "...", "rows": [
//       { "exercise": "hip_thrust", "modality": "barbell", "sets": 4,
//         "reps": [8, 12] | 10, "seconds": 30, "rest": 120, "rir": 1,
//         "superset": "A", "mode": "single_side", "band": "resistance",
//         "notes": "..." } ] }],
//     "week": ["<routine name>", ...] }   ← routines trained in one week
// ---------------------------------------------------------------------------

const draftPath = opt("draft", null);
if (draftPath) {
  const { readFileSync } = await import("node:fs");
  const draft = JSON.parse(readFileSync(draftPath, "utf8"));
  const out = [`# Draft check — ${draftPath}`, "Same coverage math as the app; nothing is written.", ""];
  const problems = [];
  const byName = new Map();
  for (const r of draft.routines ?? []) {
    const rows = (r.rows ?? []).map((x, i) => {
      const reps = Array.isArray(x.reps) ? x.reps : x.reps != null ? [x.reps, x.reps] : [null, null];
      if (!exerciseById.has(x.exercise)) problems.push(`${r.name} #${i + 1}: exercise "${x.exercise}" is not in the catalog`);
      else if (!variantKeys.has(`${x.exercise}|${x.modality}`)) {
        const have = [...variantKeys].filter((k) => k.startsWith(`${x.exercise}|`)).map((k) => k.split("|")[1]);
        problems.push(`${r.name} #${i + 1}: ${x.exercise} has no "${x.modality}" variant (has: ${have.join(", ")})`);
      }
      return {
        exercise_id: x.exercise,
        modality_id: x.modality,
        sets: x.sets ?? 1,
        rep_min: reps[0],
        rep_max: reps[1],
        duration_seconds: x.seconds ?? null,
        rest_seconds: x.rest ?? 90,
        target_rir: x.rir ?? null,
        superset_group: x.superset ?? null,
        unilateral_mode: x.mode ?? "bilateral",
        band_role: x.band ?? null,
        notes: x.notes ?? "",
      };
    });
    byName.set(r.name, rows);
    printRows(`${r.name} (draft)`, r.notes, rows, out);
  }
  if (draft.week?.length) {
    const weekItems = draft.week.flatMap((n) => items(byName.get(n) ?? []));
    out.push(`## Draft week: ${draft.week.join(", ")}`);
    out.push(...coverageLines(coverage(weekItems)));
    out.push(patternLine(weekItems));
  }
  if (problems.length) out.push("", "## Problems", ...problems.map((p) => `- ${p}`));
  console.log(out.join("\n"));
  process.exit(problems.length ? 2 : 0);
}

// ---------------------------------------------------------------------------
// Scope
// ---------------------------------------------------------------------------

const activeAssignment = (clientId) =>
  (assignments ?? [])
    .filter((a) => a.client_id === clientId && a.status === "active")
    .sort((a, b) => b.start_date.localeCompare(a.start_date))[0] ?? null;

let scopeClients = clients.filter((c) => c.status !== "inactive" && c.status !== "archived");
let scopePrograms = programs;
if (onlyClient) {
  scopeClients = clients.filter((c) => c.id === onlyClient);
  if (!scopeClients.length) {
    console.error(`No client "${onlyClient}". Known: ${clients.map((c) => c.id).join(", ")}`);
    process.exit(1);
  }
  const touched = new Set((assignments ?? []).filter((a) => a.client_id === onlyClient).map((a) => a.program_id));
  scopePrograms = programs.filter((p) => touched.has(p.id));
}
if (onlyProgram) {
  scopePrograms = programs.filter((p) => p.id === onlyProgram);
  if (!scopePrograms.length) {
    console.error(`No program "${onlyProgram}". Known: ${programs.map((p) => p.id).join(", ")}`);
    process.exit(1);
  }
  const on = new Set((assignments ?? []).filter((a) => a.program_id === onlyProgram).map((a) => a.client_id));
  if (!onlyClient) scopeClients = clients.filter((c) => on.has(c.id));
}

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

const out = [];
out.push(`# Gym digest — ${TODAY}`);
out.push(`Live Supabase data, read-only. "Actual" sections cover the ${WEEKS} weeks from ${windowStart} (Monday-start weeks). Coverage = the app's weighted sets (sets × score/10): <2 or peak <5 neglected, <6 light, 6+ solid.`);
out.push("");

// ---- People ----
out.push("## People");
const latestWeighIn = (id) =>
  (weighIns ?? []).filter((w) => w.client_id === id).sort((a, b) => b.date.localeCompare(a.date))[0];
for (const c of scopeClients) {
  const a = activeAssignment(c.id);
  const w = latestWeighIn(c.id);
  let plan = "no active program — the launcher defaults to the routine they did last";
  if (a) {
    const p = programById.get(a.program_id);
    const week = Math.floor((dayNum(TODAY) - dayNum(a.start_date)) / 7) + 1;
    plan =
      a.start_date > TODAY
        ? `assigned **${p?.name ?? a.program_id}**, starts ${a.start_date} (${p?.weeks ?? "?"} weeks)`
        : `on **${p?.name ?? a.program_id}** since ${a.start_date} (week ${week} of ${p?.weeks ?? "?"}${p && week > p.weeks ? " — past its end" : ""})`;
  }
  const past = (assignments ?? [])
    .filter((x) => x.client_id === c.id && x.status !== "active")
    .map((x) => `${programById.get(x.program_id)?.name ?? x.program_id} ${x.start_date} ${x.status}`);
  out.push(
    `- **${c.first_name}** (\`${c.id}\`) — age ${ageOn(c.date_of_birth, TODAY) ?? "?"}, ${c.height_inches ?? "?"} in, ${c.experience_level}, goal ${c.goal}${c.is_trainer ? ", trainer" : ""}${w ? `, ${w.bodyweight_lbs} lb (${w.date})` : ""}. ${plan}.${past.length ? ` Past: ${past.join("; ")}.` : ""}${c.notes ? ` Notes: "${c.notes}"` : ""}`,
  );
}
out.push("");

// ---- Programs ----
out.push("## Programs");
const shownRoutines = new Set();
for (const p of scopePrograms) {
  const days = programDays.filter((d) => d.program_id === p.id);
  const weeks = groupBy(days, (d) => d.week);
  out.push(`### Program: ${p.name} (\`${p.id}\`) — ${p.weeks} weeks`);
  if (p.notes) out.push(`_${p.notes}_`);
  const people = (assignments ?? [])
    .filter((a) => a.program_id === p.id)
    .map((a) => `${firstName(a.client_id)} (${a.status}, from ${a.start_date})`);
  out.push(`- Assignments: ${people.join(", ") || "none"}`);
  // Collapse runs of identical weeks.
  const sig = (w) => (weeks.get(w) ?? []).sort((a, b) => a.day_of_week - b.day_of_week).map((d) => `${DOW[d.day_of_week]} ${routineName(d.routine_id)}`).join(", ");
  let start = 1;
  for (let w = 1; w <= p.weeks + 1; w++) {
    if (w <= p.weeks && sig(w) === sig(start)) continue;
    const label = start === w - 1 ? `Week ${start}` : `Weeks ${start}–${w - 1}`;
    out.push(`- ${label}: ${sig(start) || "(empty)"}`);
    const weekItems = (weeks.get(start) ?? []).flatMap((d) => items(rowsByRoutine.get(d.routine_id) ?? []));
    out.push(`- ${label} coverage (weighted sets per week):`);
    out.push(...coverageLines(coverage(weekItems)));
    out.push(patternLine(weekItems));
    start = w;
  }
  out.push("");
  for (const d of days) {
    if (shownRoutines.has(d.routine_id)) continue;
    shownRoutines.add(d.routine_id);
    printRoutine(d.routine_id, out);
  }
}

// Routines the scoped people actually ran that no scoped program shows.
const scopeIds = new Set(scopeClients.map((c) => c.id));
const ranRoutineIds = new Set(
  sessions.filter((s) => scopeIds.has(s.client_id) && s.routine_id && s.date >= windowStart).map((s) => s.routine_id),
);
const extra = [...ranRoutineIds].filter((id) => !shownRoutines.has(id));
if (extra.length) {
  out.push("## Other routines they ran");
  for (const id of extra) {
    shownRoutines.add(id);
    printRoutine(id, out);
  }
}

// ---- Actual training, per person ----
out.push("## What they actually did");
const PAIN = /\b(pain|hurt|hurts|ache|aching|sore|tweak|tweaked|pinch|pinched|strain|sprain|injur|swell|swollen|numb|tingl|sharp|knee|ankle|back|shoulder|hip|elbow|wrist|neck)\w*/i;
const e1rm = (w, reps) => w * (1 + reps / 30); // Epley

for (const c of scopeClients) {
  const mine = sessions
    .filter((s) => s.client_id === c.id && s.date >= windowStart && s.date <= TODAY)
    .sort((a, b) => a.date.localeCompare(b.date));
  const done = mine.filter((s) => s.status === "completed");
  out.push(`### ${c.first_name} (\`${c.id}\`)`);
  if (!done.length) {
    out.push(`- No completed sessions in the window.`);
    out.push("");
    continue;
  }
  const perWeek = new Map(windowWeeks.map((w) => [w, 0]));
  for (const s of done) perWeek.set(weekKey(s.date), (perWeek.get(weekKey(s.date)) ?? 0) + 1);
  const firstWeek = weekKey(done[0].date);
  const activeWeeks = windowWeeks.filter((w) => w >= firstWeek);
  out.push(`- ${done.length} completed sessions over ${activeWeeks.length} weeks (since first in window) = ${(done.length / activeWeeks.length).toFixed(1)}/week. Weeks with 0: ${activeWeeks.filter((w) => !perWeek.get(w)).length}.`);
  out.push(`- Per week: ${activeWeeks.map((w) => `${w.slice(5)}:${perWeek.get(w)}`).join(" ")}`);
  const dows = groupBy(done, (s) => DOW[((dayNum(s.date) + 3) % 7) + 1]);
  out.push(`- Training days: ${[...dows].map(([d, ss]) => `${d} ${ss.length}`).join(", ")}`);
  const ran = groupBy(done, (s) => routineName(s.routine_id));
  out.push(`- Routines run: ${[...ran].map(([n, ss]) => `${n} ×${ss.length}`).join(", ")}`);
  const durations = done.map((s) => s.duration_minutes).filter((m) => m != null && m >= 15 && m <= 180);
  if (durations.length) out.push(`- Duration (plausible logs only): median ${durations.sort((a, b) => a - b)[Math.floor(durations.length / 2)]} min`);
  out.push(`- RPE / condition: ${done.map((s) => `${s.date.slice(5)} ${s.rpe ?? "–"}${s.condition ? `/${s.condition}` : ""}`).join(", ")}`);

  // Logged sets: completed, not warm-ups.
  const logs = done.flatMap((s) => (logsBySession.get(s.id) ?? []).map((l) => ({ ...l, date: s.date, routineId: s.routine_id })));
  const work = logs.filter((l) => l.completed && !l.is_warmup);
  const incomplete = logs.filter((l) => !l.completed).length;
  out.push(`- Sets logged: ${work.length} completed working sets, ${incomplete} left incomplete (${logs.length ? Math.round((incomplete / logs.length) * 100) : 0}%).`);

  // Logged coverage, averaged per week.
  const loggedCov = coverage(work.map((l) => ({ exerciseId: l.exercise_id, modalityId: l.modality_id, sets: 1 })));
  out.push(`- Logged coverage, avg weighted sets per week (÷${activeWeeks.length}):`);
  out.push(...coverageLines(loggedCov, 1 / activeWeeks.length));

  // Prescribed vs done (swaps / additions / skips).
  const added = new Map();
  const skipped = new Map();
  for (const s of done) {
    if (!s.routine_id) continue;
    const planned = new Set((rowsByRoutine.get(s.routine_id) ?? []).map((r) => r.exercise_id));
    const did = new Set((logsBySession.get(s.id) ?? []).filter((l) => l.completed).map((l) => l.exercise_id));
    for (const e of did) if (!planned.has(e)) added.set(e, (added.get(e) ?? 0) + 1);
    for (const e of planned) if (!did.has(e)) skipped.set(e, (skipped.get(e) ?? 0) + 1);
  }
  const fmt = (m) => [...m].sort((a, b) => b[1] - a[1]).map(([e, n]) => `${e} ×${n}`).join(", ") || "none";
  out.push(`- Off-plan additions/swaps: ${fmt(added)}. Prescribed but not done: ${fmt(skipped)}.`);

  // Lift trends: exact loads → top set per session by Epley e1RM.
  const loaded = groupBy(
    work.filter((l) => l.weight_lbs != null && l.weight_lbs > 0 && l.band_id == null && (l.reps ?? 0) > 0),
    (l) => `${l.exercise_id}|${l.modality_id}`,
  );
  const trendRows = [];
  for (const [k, ls] of loaded) {
    const perSession = [...groupBy(ls, (l) => l.session_id).values()]
      .map((xs) => xs.reduce((best, l) => (e1rm(l.weight_lbs, l.reps) > e1rm(best.weight_lbs, best.reps) ? l : best)))
      .sort((a, b) => a.date.localeCompare(b.date));
    if (!perSession.length) continue;
    const first = perSession[0];
    const last = perSession[perSession.length - 1];
    const half = Math.floor(perSession.length / 2);
    const best = (xs) => Math.max(...xs.map((l) => e1rm(l.weight_lbs, l.reps)));
    let trend = "";
    if (perSession.length >= 4) {
      const early = best(perSession.slice(0, half));
      const late = best(perSession.slice(half));
      const pct = ((late - early) / early) * 100;
      trend = pct > 2.5 ? ` ↑ +${pct.toFixed(0)}%` : pct < -2.5 ? ` ↓ ${pct.toFixed(0)}%` : " → STALLED (flat)";
    }
    const [ex, mod] = k.split("|");
    trendRows.push(`  - ${ex} (${mod}) ×${perSession.length}: ${first.date.slice(5)} ${first.weight_lbs}×${first.reps} → ${last.date.slice(5)} ${last.weight_lbs}×${last.reps}${trend}`);
  }
  if (trendRows.length) {
    out.push("- Loaded lifts, top set per session (first → last; trend compares best e1RM of first vs second half, ≥4 exposures; DB weight is per hand):");
    out.push(...trendRows.sort());
  }
  // No-lb work (bands, bodyweight, blank loads): reps and band rank — never pounds.
  const ordinal = groupBy(work.filter((l) => l.band_id != null || l.weight_lbs == null), (l) => `${l.exercise_id}|${l.modality_id}`);
  const ordRows = [];
  for (const [k, ls] of ordinal) {
    const sessionsN = new Set(ls.map((l) => l.session_id)).size;
    if (sessionsN < 2) continue;
    const sorted = [...ls].sort((a, b) => a.date.localeCompare(b.date));
    const show = (l) => {
      const band = l.band_id ? bandById.get(l.band_id) : null;
      const bandLabel = band ? `${band.label}${hipBandRank.has(band.id) ? ` (hip rank ${hipBandRank.get(band.id)})` : ""}` : null;
      const dose = l.duration_seconds ? `${l.duration_seconds}s` : `${l.reps ?? "?"} reps`;
      return `${l.date.slice(5)} ${[bandLabel, dose].filter(Boolean).join(" ")}`;
    };
    const [ex, mod] = k.split("|");
    ordRows.push(`  - ${ex} (${mod}) ×${sessionsN}: ${show(sorted[0])} → ${show(sorted[sorted.length - 1])}`);
  }
  if (ordRows.length) {
    out.push("- Work with no lb value — bands, bodyweight, or loads left blank (first → last; bands are ordinal):");
    out.push(...ordRows.sort());
  }

  // Notes — flag anything that reads like a body complaint.
  const notes = [
    ...done.filter((s) => s.notes?.trim()).map((s) => ({ date: s.date, text: s.notes.trim(), where: routineName(s.routine_id) })),
    ...work.concat(logs.filter((l) => !l.completed)).filter((l) => l.notes?.trim()).map((l) => ({ date: l.date, text: l.notes.trim(), where: l.exercise_id })),
  ];
  if (notes.length) {
    out.push("- Notes (⚠ = reads like pain/injury — PT lens):");
    for (const n of notes.sort((a, b) => a.date.localeCompare(b.date))) {
      out.push(`  - ${PAIN.test(n.text) ? "⚠ " : ""}${n.date} [${n.where}]: "${n.text}"`);
    }
  }

  // Runs.
  const myRuns = (runs ?? []).filter((r) => r.client_id === c.id && r.date.slice(0, 10) >= windowStart);
  if (myRuns.length) {
    const rw = new Map(activeWeeks.map((w) => [w, { mi: 0, n: 0, long: 0, kinds: [] }]));
    const firstRunWeek = weekKey(myRuns.map((r) => r.date).sort()[0]);
    for (const r of myRuns) {
      const w = weekKey(r.date);
      if (!rw.has(w)) rw.set(w, { mi: 0, n: 0, long: 0, kinds: [] });
      const e = rw.get(w);
      e.mi += r.distance_miles ?? 0;
      e.n += 1;
      e.long = Math.max(e.long, r.distance_miles ?? 0);
      e.kinds.push(r.kind);
    }
    const weeksShown = [...rw.keys()].filter((w) => w >= firstRunWeek).sort();
    const total = myRuns.reduce((a, r) => a + (r.distance_miles ?? 0), 0);
    out.push(`- Runs: ${myRuns.length} runs, ${total.toFixed(1)} mi over ${weeksShown.length} weeks = ${(total / weeksShown.length).toFixed(1)} mi/week, ${(myRuns.length / weeksShown.length).toFixed(1)} runs/week.`);
    let prev = null;
    const cells = weeksShown.map((w) => {
      const e = rw.get(w);
      const ramp = prev && prev.mi > 0 ? ` (${e.mi >= prev.mi ? "+" : ""}${Math.round(((e.mi - prev.mi) / prev.mi) * 100)}%)` : "";
      prev = e;
      return `${w.slice(5)}: ${e.mi.toFixed(1)} mi/${e.n} runs, long ${e.long.toFixed(1)}${ramp}`;
    });
    out.push(`  - ${cells.join(" | ")}`);
    const paced = myRuns.filter((r) => r.duration_seconds && r.distance_miles);
    if (paced.length) {
      const pace = paced.reduce((a, r) => a + r.duration_seconds, 0) / paced.reduce((a, r) => a + r.distance_miles, 0);
      const hr = paced.filter((r) => r.avg_heart_rate).map((r) => r.avg_heart_rate);
      out.push(`  - Avg pace ${Math.floor(pace / 60)}:${String(Math.round(pace % 60)).padStart(2, "0")}/mi${hr.length ? `, avg HR ${Math.round(hr.reduce((a, b) => a + b, 0) / hr.length)}` : ""}. Kinds: ${[...groupBy(myRuns, (r) => r.kind)].map(([k, rs]) => `${k} ${rs.length}`).join(", ")}`);
    }
  }
  out.push("");
}

console.log(out.join("\n"));
