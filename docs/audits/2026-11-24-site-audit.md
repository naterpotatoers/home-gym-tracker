# Site audit — 2026-11-24

What would make the app easier and better to use, what was fixed in this
round, and what to do next. Based on a read of every page and form, a
code-health sweep of `src/`, and the 7 Echo Bike pieces logged so far.

## Headline

- The foundations are sound: the rules in `AGENTS.md` are actually held (no
  client file touches Supabase, the query layer is pure, no `any`, no TODOs),
  inputs and touch targets meet the iPad rules everywhere, and live-session
  saving is careful.
- The friction is in three places: **the launcher guessed the wrong workout**,
  **the bike form asked for too much and judged it wrongly**, and **long text
  had nowhere to live**. All three are fixed below.
- The biggest thing not fixed: **the app has no login or passcode.** See
  "Next", item 1.

## Fixed in this round

### Echo Bike form

| Problem | What changed |
|---|---|
| Five console numbers typed per person per ride | The card asks for two things: **average watts** and **effort**. Max watts, cadence, distance, calories and target RPM sit behind **More numbers** (it opens by itself on a piece that already has one). |
| Every 20/10 ride read "below target" | The target means **watts in the work bouts**; the console's average runs through the rests (250 W bouts read about 170 W). Interval rides are no longer judged against the target. The card shows the person's **last ride of the same kind** ("Last · Nov 23 · 169 W avg · effort 8") and how today compared ("+12 W vs Nov 23"). Steady rides keep hit / below / well above. |
| Only 20/10 ×8, 10/20 ×8 or steady | **Custom…** gives rounds × work / rest with the total time shown. One shared picker (`src/components/piece-picker.tsx`) now serves the live card and the routine editor. |
| Small captions, narrow LOG | Captions are 12 px, LOG is full width, and the whole card fits a 3-across board card on the iPad without scrolling. |
| Warm-up described as "easy, RPE 3–4" | Now "Brisk, RPE 5–6 — get warm, don't empty the tank", which matches how it's ridden. 20/10 stays the default. |

Three bugs found on the way, all of which only bite once a block has more
than one piece (bike-only days):

- Changing the target on piece 1 didn't reach the pieces still to ride.
- Changing the piece type copied the new length to later pieces but not the
  new interval, leaving them inconsistent.
- Typing piece 1's distance copied it onto later pieces, and **Add piece**
  copied the previous piece's whole readout.

Fixed in `src/lib/set-blocks.ts` (`cascadeInto`, `nextSetLike`): a bike piece
passes on its plan (length, interval, targets) and never what the console read.

**One consequence to know:** an interval target no longer steps up by itself
(the app can't tell whether it was hit). It carries over from the person's
last ride and is raised by hand on their card — the same rule as lifting
pre-fill. A steady target still goes up a notch after two hits in a row.

### Quick wins

- **Launcher default.** On a day off, each person now defaults to what's next
  in *their* program (the first day of this program week not yet done, so a
  missed Monday comes before Friday) instead of the routine they did last.
  Before this, Vivica and Arnold defaulted to an old shared routine. A program
  day already finished today is labelled "done today" and no longer
  pre-checked. (`src/lib/launcher.ts`)
- **Multi-line notes.** Routine notes, row notes, program notes, session notes
  and client notes are now boxes that grow with the text
  (`Textarea` in `src/components/ui.tsx`). Routine and program notes get their
  own full-width line.
- **Plates and bars.** The 1.25 lb pair is out of `src/lib/data/equipment.ts`
  until it's bought (a comment there says what to put back), so barbell loads
  are on an honest 5 lb grid. The plate hint now works out which bar is loaded
  from the weight — 45, 50, 55… is the Ohio bar; 33, 38, 43… the Bella — and
  says so ("Bella Bar + 5 per side"). Lidia's weights never got a hint before.
- **Errors are announced** to screen readers (`ErrorText` has `role="alert"`).

### Checked

`npm run verify` passes (533 unit tests, build). `npm run e2e` passes (10
tests), including a new `e2e/bike.spec.ts` for the custom interval and the
piece-to-piece behaviour. Looked at on screen: the new card on an
iPad-landscape viewport (solo and 3-across), the routine editor's bike row,
the launcher's new defaults, and the notes boxes on a routine and a client
profile. Covered by unit tests but not looked at on screen: the Bella-bar
hint, the "done today" label, and the notes box on the finish panel.

## Next — ranked

### Easier to use

1. **Put a lock on it.** There is no login or passcode, and the database
   policy allows everything (`supabase/schema.sql`, "anon_all"). If the Vercel
   address is reachable by anyone, they can read and change ages, body
   weights and pain notes. Cheapest fix: turn on Vercel deployment protection;
   next cheapest: one shared passcode checked in a `proxy.ts`.
2. **Undo, and reopening a finished session.** "Delete set" is instant with no
   way back (`src/components/set-row.tsx`). A finished session is read-only,
   so a set forgotten before Finish can't be added. A 5-second "Undo" toast
   and a "Reopen" button on the recap would cover both.
3. **Replace the 16 native `confirm()` pop-ups** with the in-app
   `ConfirmDialog`, which exists and is used exactly once. Three wrappers
   cover most of them: `confirm-delete-button.tsx`, `maintenance-submit.tsx`,
   and the editors' delete/remove handlers.
4. **Show errors where the tap was.** A failed Start lands on the full-page
   "Something broke" (`startGroupFromForm` throws; the launcher has no error
   slot). Same for New routine / New program and catalog Import.
5. **Routine editor:** drag to reorder (today it is one "Move up" per menu
   open), and a hint when a routine has no rows. **Program editor:** "fill
   every week like week 1" instead of one select per day per week.
6. **Clients page:** a body-weight chart (today a text list of 12), the
   per-person muscle map the page's own comment promises
   (`src/app/users/page.tsx`), and a multi-day nutrition view.
7. **Exercise editor:** warn before a nav tab throws away unsaved edits (only
   the "← Library" link is guarded, `unsaved-guard.tsx`).
8. **Bike-only days, further:** a recap that shows ride time and calories
   instead of "Volume 0 lb"; pre-fill predictions that snap to the Bella's
   grid for a Bella lifter (`nearestLoadableWeight` assumes the Ohio bar).
9. Smaller: superset letters are case-sensitive ("a" and "A" never pair —
   `session-labels.ts`); a few fields have only a placeholder as a label
   (food search, exercise search, the exercise editor's muscle/role/modality
   selects); `weightStep("dumbbell")` is 2.5 lb although the dumbbells are
   fixed pairs 5 lb apart.

### Code and process

1. **Smaller commits.** The last four were 47, 53, 105 and 119 files, each
   mixing features, fixes and refactors. One change per commit makes a bad
   one easy to find and undo. A pre-commit `typecheck + lint + test` (about
   10 s) would catch breakage before it lands.
2. **CI:** add a plain `npm run build` step — a broken build currently
   surfaces as an e2e failure. E2E covers only the live session; the routine
   editor, program editor, exercise authoring and Clients have none.
3. **Writes that should be all-or-nothing and aren't:** starting sessions
   (`insertSessions` in `actions/_helpers.ts` — sessions then sets, with a
   best-effort delete), duplicate program, catalog import and re-sync, run
   sync. `AGENTS.md` asks for a Postgres function + `rpc()` for these.
4. **Drift from the project's own rules** (all small):
   - `actions/nutrition.ts` and `actions/runs.ts` export types from a
     `"use server"` file.
   - Row shapes are built outside `mappers.ts` in `validate.ts`
     (`parseProfile`), `actions/workout.ts` (`finishSession`) and a few reads
     in `actions/programs.ts` / `exercises.ts` / `runs.ts`.
   - `RPC_MIGRATION.sync_set_logs` names `2026-11-16-hardening.sql`, but the
     function was last redefined in `2026-11-23-bike-effort.sql`.
   - `fill_exercise_cues` exists in a migration but not in `schema.sql`.
   - `clientSummaries` in `queries.ts` reads the clock (`new Date()` default).
5. **Files worth splitting the next time they're touched:**
   `exercise-editor.tsx` (764 lines), `routine-editor.tsx` (about 630),
   `use-set-editor.ts` (about 500).
6. **Tidy:** unused exports (`WARMUP_MINUTES`, `SetListSnapshot`,
   `assignmentToRow`); the README predates the bike and e2e work;
   `@types/node` is 20 while CI runs Node 22; consider
   `noUncheckedIndexedAccess` in `tsconfig.json`.
