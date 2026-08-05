<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

Known Next 16 gotchas already honored in this codebase: `params`/`searchParams` are Promises (await them), `error.tsx` receives `unstable_retry` not `reset`, no `export const dynamic`/`revalidate` (data loaders call `connection()` instead), nav hooks come from `next/navigation`.

# Project conventions

## Architecture (don't fight it)

- **Hybrid storage.** Reference data (muscles, modalities, equipment, exercises) is TypeScript in `src/lib/data/` with id unions — never move it to the DB. Mutable data (clients, routines, programs, program_days, assignments, sessions, set_logs, weigh_ins) is Supabase; schema lives in `supabase/migrations/`. Clients graduated to the DB in `002_clients.sql` (so people can be added/edited at `/users`): `ClientId` is an open string, the TS roster in `src/lib/data/clients.ts` is seed + read-only fallback (`GymData.clientsSource === "seed"` while 002 hasn't run), and client ids are validated at write time via `assertClientId` in `src/lib/actions/clients.ts`, not a compile-time union. Client card colors come from the `CLIENT_COLORS` presets only — never free hex.
- **Reads = snapshot.** Server pages call `loadGymData()` (`src/lib/db/snapshot.ts`, server-only, per-request `cache()`); it falls back to the TS seed (`GymData.source === "seed"`) only while the migration hasn't run. Query functions in `queries.ts`/`modality.ts`/`coverage.ts` are pure and synchronous over `(data: GymData, ...)` — keep new ones that way; never fetch inside them.
- **Writes = server actions** in `src/lib/actions/`. The browser never imports the Supabase client. Every action validates text FKs against the unions via `src/lib/validate.ts` and ends with `revalidatePath("/", "layout")`.
- **snake_case rows ↔ camelCase types** map only in `src/lib/db/mappers.ts`. `RoutineExercise.order` ↔ column `sort_order`; both mapper directions must stay complete when a type changes.

## Domain invariants (the model's whole point)

- Loads are honest: `LoadPrecision` is `exact`/`approximate`/`ordinal`. Ordinal (hip-band) work NEVER gets a pound value, an e1RM, or a place in a lbs total — it's tracked as band rank + reps and rendered hatched/separately.
- `SetLog.reps` is per side; `weightLbs` is per implement; totals are derived (`setLoad`).
- `SetLog.position` is session-wide performed order and must survive every structural edit — `blocksFor`/`toBlocks` group consecutive sets by it. Renumber via `renumber()` in `src/lib/set-blocks.ts`.
- Muscle work derives from `exerciseMuscleScores` × modality modifiers (`effectiveScores`); exercises deliberately have no muscleGroup field. A modality modifier adjusts, never introduces, a muscle.
- Ids are readable slugs (`newId`/`slugId` in `src/lib/ids.ts`), never numbers.
- Date/time helpers live ONLY in `src/lib/periods.ts` (local ISO strings for display/storage, UTC day numbers for trend math — never mix). Meter view-model types live in `src/lib/meters.ts`; session card label/cursor helpers in `src/lib/session-labels.ts`.

## UI conventions

- Tailwind v4 utilities only, no component library. Color comes from semantic tokens in `globals.css` (`@theme inline`): surfaces (`background`/`surface`/`surface-input`), borders (`border`/`border-strong`), text (`foreground`/`muted`), the blue accent family (`accent`/`accent-strong`/`accent-fg`/`accent-text`/`accent-soft`), the warm amber-orange action family (`accent-warm`/…, filled primary "do the thing" buttons only — deliberately more orange than the gold `warning` token), and reserved status colors `success`/`warning`/`danger` (+ `-text` variants) meaning good/okay/bad. Never hardcode a hex in a component. `currentColor` blends (`hover:bg-current/5`, `bg-current/10` chips) survive only as hover washes and neutral tags. Mono for numbers.
- **Status color is never the only encoding** — pair it with a text label and legend (`StatusLabel`/`MeterLegend` in `src/components/meter-rows.tsx`); red↔green alone is colorblind-hostile. Ordinal (hip-band) work renders as the hatched indicator, never as length in a lbs bar.
- Controls come from `src/components/ui.tsx` (`Button`/`Input`/`NumberInput`/`Select`/`Field`/`IconButton`/`Card`/`PageShell`): inputs sit on `bg-surface-input` at `text-base` (16px — anything smaller makes iOS Safari zoom on focus), touch targets are ≥44px (`min-h-11`/`size-11`; `size="sm"` only for dense desktop table cells), focus is `focus-visible:ring-2 ring-accent/60` — never bare `outline-none`. Pages wrap in `PageShell`; wide tables get the `-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0` scroller.
- Mobile-first: nav is a top bar on `md:+` and a fixed bottom tab bar below (`PageShell`'s `pb-24` clears it). Dark mode is media-query driven (`color-scheme: light dark` set on `:root`). The heat ramp (`--heat-0..12`) is a graded status scale — danger → warning → success, OKLab-interpolated from the status tokens, with its own dark-mode anchors (hue carries meaning, so no reversal) — and stays out of `@theme`; zero work renders outline-only, never the red end.
- Server components by default; interactivity lives in `'use client'` files under `src/components/`. Session editing goes through the `useSetEditor` hook (debounced `updateSetLog` for field edits, `syncSetLogs` for structural changes) — the solo runner and group-board cards both use it.
- The body heat map's regions live in `src/lib/body-map.ts` as a `Record<MuscleId, …>` so an unmapped muscle is a compile error; one view (front or back) per muscle.

## Verify before done

`npm run verify` (typecheck + lint + unit tests + build; the pure query layer is tested with vitest against `seedSnapshot()` — add tests beside the module as `src/lib/*.test.ts` when touching domain math), then render-check touched routes against the dev server (usually already running on :3000 — don't kill it, don't start a second one on the same project). Write-path changes need the live DB (`/dev/seed` shows its state). For SVG/visual work: extract the SSR'd markup, rasterize with `qlmanage -t`, and actually look at it.
