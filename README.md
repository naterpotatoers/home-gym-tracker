# Home Gym

A training app for a household garage gym: build programs, run workouts (solo
or everyone at once from one phone), and explore strength history — backed by
an honest data model that never fakes a number it doesn't have.

## Features

- **Program builder** (`/routines`, `/programs`) — author daily routines
  (exercise + implement, sets, rep range, rest, RIR, supersets) with a live
  muscle-coverage preview; arrange them on a weeks × days grid; see which
  muscles a week neglects; assign programs to people.
- **Workout runner** (`/workout`) — start today's program day or any routine.
  Every set is prefilled from your last performance and editable per set;
  exercises can be swapped mid-session. Ends with an optional effort check-in
  (session RPE 1–10 + how you felt).
- **Group board** (`/workout/group`) — several people training at once,
  staggered across equipment, all logged from one shared device. One tap logs
  a set as prefilled; rest countdowns show whose turn it is.
- **Metrics** (`/metrics`) — cross-client PR comparisons, "what weight fits
  8–10 reps," and the reverse, with plate-loadable suggestions.
- **Muscle heat map** (`/metrics/heatmap`) — front/back body figures colored
  by per-muscle training intensity; compare day/week/program periods on one
  shared scale. Band-only work is hatched (rank-based, no fake pounds).
- **Library** (`/library`) — inventory, modality tradeoffs, and worked
  examples of the data-model decisions.

## Setup

```bash
npm install
```

Create `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=<your project url>
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<your publishable key>
```

**Database (one time):** run `supabase/migrations/001_init.sql` in the
Supabase SQL editor (the publishable key can't create tables), then start the
app and visit `/dev/seed` to load the seed data. Until then the app runs
read-only off the TypeScript seed and shows a banner. `002_effort.sql` is only
for databases created from a pre-effort-columns version of 001.

```bash
npm run dev    # http://localhost:3000
npm run build
npm run lint
```

## Architecture

**Hybrid storage.** Hand-curated reference data lives in TypeScript
(`src/lib/data/`: muscles, modalities, equipment, exercises, clients) where
union types make a typo'd id a compile error. Data that grows — routines,
programs, assignments, sessions, set logs, weigh-ins — lives in Supabase.

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
