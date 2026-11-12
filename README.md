# Nates Gym

A training app for a household garage gym: build programs, run workouts (solo
or everyone at once from one phone), and explore strength history — backed by
an honest data model that never fakes a number it doesn't have.

## Features

- **Program builder** (`/programs`) — author daily routines (exercise +
  implement, sets, rep range, rest, RIR, supersets) with a live
  muscle-coverage preview; arrange them on a weeks × days grid; see which
  muscles a week neglects; assign programs to people.
- **Workout runner** (`/workout`) — start today's program day or any routine.
  Every set is prefilled from your last performance and editable per set;
  exercises can be swapped mid-session. Ends with an optional effort check-in
  (session RPE 1–10 + how you felt).
- **Group board** (`/workout/group`) — several people training at once,
  staggered across equipment, all logged from one shared device. One tap logs
  a set as prefilled; rest countdowns show whose turn it is.
- **People** (`/users`) — per-person hub: profile, weigh-ins, recent
  workouts, e1RM progress charts, cross-client PR comparisons, "what weight
  fits 8–10 reps," and the reverse, with plate-loadable suggestions.
- **Running** (Clients › Progress) — runs synced from Strava (Garmin → Strava → here) or
  logged by hand: this week's runs and miles, six weeks of mileage, pace and
  heart rate. Runs live in their own table and never count as lifting volume.
- **Muscle heat map** (`/metrics/heatmap`) — front/back body figures colored
  by per-muscle training intensity; compare day/week/program periods on one
  shared scale. Band-only work is hatched (rank-based, no fake pounds).

## Setup

```bash
npm install
```

Create `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=<your project url>
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<your publishable key>
```

**Database (one time):** run `supabase/schema.sql` in the Supabase SQL
editor (the publishable key can't create tables), then start the app and add
people at `/users`. Until then the app runs read-only off the TypeScript seed
and shows a banner.

### Strava sync (optional)

Runs import from Strava for one person. Credentials stay in server env vars
only — never the database, which anyone holding the publishable key can read.

1. Run `supabase/migrations/2026-11-07-runs.sql` in the Supabase SQL editor.
2. Create an API app at <https://www.strava.com/settings/api>. Any name and
   website work; set **Authorization Callback Domain** to `localhost`.
3. Add to `.env.local`:
   ```
   STRAVA_CLIENT_ID=<Client ID>
   STRAVA_CLIENT_SECRET=<Client Secret>
   STRAVA_ATHLETE=<the gym client id the runs belong to, e.g. nate>
   ```
4. `node scripts/strava-auth.mjs`: open the printed link and click
   Authorize. The browser lands on a `localhost/exchange_token?...code=…` page
   that won't load; copy the `code` value, then run
   `node scripts/strava-auth.mjs <code>` and add the printed
   `STRAVA_REFRESH_TOKEN=…` to `.env.local`.
5. Restart the dev server. Add the same four variables in Vercel → Settings →
   Environment Variables, then redeploy.

The athlete's Clients › Progress tab syncs on open (at most every 30 minutes) and has a **Sync Strava**
button. The first sync pulls the last 90 days. If Strava ever rejects the
token, repeat step 4.

**Older history:** the live sync looks back only 90 days. To backfill further,
request your archive on Strava (Settings › My Account › Download or Delete
Your Account) and run
`node scripts/strava-import.mjs <archive>/activities.csv <clientId>`. That
command is a dry run; add `--write` to insert. It imports runs only, skipping
hikes, walks and rides. Each run is keyed on the same `strava:<id>` as the
sync, so re-running the import, or a later sync, never creates duplicates.

```bash
npm run dev    # http://localhost:3000
npm run build
npm run lint
```

## Architecture

**Hybrid storage.** Hand-curated reference data lives in TypeScript
(`src/lib/data/`: muscles, modalities, equipment) where union types make a
typo'd id a compile error. Data that grows or gets edited — clients, the
exercise catalog (with muscle scores and variants), routines, programs,
assignments, sessions, set logs, weigh-ins, foods, food logs — lives in
Supabase; the schema is `supabase/schema.sql`. The exercise catalog and the
pre-built Care routines are seeded from TypeScript via import buttons at
`/exercises` and `/programs`, with the TS files doubling as the read-only
fallback before the tables exist. The evidence behind the muscle scores and
care prescriptions is documented in `docs/exercise-scoring-references.md` and
`docs/pt-exercise-references.md`.

**Snapshot reads.** `loadGymData()` (`src/lib/db/snapshot.ts`, server-only)
fetches all mutable tables per request into a `GymData` object. Every query
function in `src/lib/queries.ts` / `modality.ts` / `coverage.ts` is a pure,
synchronous function over `(data, ...)` — testable without a database.

**Server-action writes.** The browser never talks to Supabase; client
components call actions in `src/lib/actions/`. Foreign keys into reference
data are plain text in SQL, validated against the TS unions in
`src/lib/validate.ts` before every insert.

**Honest measurements.** Loads carry a precision (`exact` / `approximate` /
`ordinal`); hip-band work has no pound value and is tracked by band rank and
reps, never folded into lb totals. Per-set `modalityId` records mid-session
implement switches faithfully. See `src/lib/types.ts` for the model and its
reasoning.
