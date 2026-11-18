# Mapping a prescription onto the app

## Where things live

- Mutable data (clients, exercises + scores, routines, programs,
  program_days, assignments, sessions, set_logs, runs) is in Supabase; the
  digest script reads it. Schema: `supabase/schema.sql`.
- Reference data is TypeScript: muscles (`src/lib/data/muscles.ts`),
  modalities and their muscle modifiers (`src/lib/data/modalities.ts`),
  equipment (`src/lib/data/equipment.ts`).
- Equipment that bounds every prescription: half rack + spotter arms,
  pull-up bar, dip bars, Ohio bar (45 lb) and Bella bar (33 lb), plates
  down to 1.25s (2.5 lb steps), **fixed dumbbells 3/5/8/10/15–50 lb in 5s**,
  flat/incline/decline bench, loop bands (orange < red < blue < green), two
  hip bands (14" easier, 12" harder — ordinal), Echo Bike. No cables, no
  machines, no leg curl, no GHD.
- Evidence docs: `docs/exercise-scoring-references.md` (muscle scores),
  `docs/pt-exercise-references.md` (care routines, tiers).

## A routine row (`RoutineExercise`)

| Field | Editor control | Notes |
|---|---|---|
| exerciseId + modalityId | "Add exercise" picker / row menu → "Swap exercise" | a variant = exercise × implement; must exist in the catalog |
| sets | Sets stepper | |
| repMin / repMax | Reps: "Single" or "Range" toggle | timed exercises show **Seconds** instead (`durationSeconds`) |
| restSeconds | Rest (s) stepper, steps of 15 | |
| targetRir | Target RIR stepper 0–5 | leave blank for care/mobility |
| supersetGroup | Superset select: —, A, B, C | adjacent rows with the same letter run interleaved |
| unilateralMode | Mode: bilateral / alternating / single side | a single-side row's sets count once in coverage |
| bandRole | Band role select (only when the variant allows several) | a row can't pin a specific band; band is picked at log time → put "progress by band rank" in notes |
| notes | Notes text | cues, start load, progression rule, swap rule |
| conditioning | bike rows: pieces / piece / minutes / target watts / RPM | `echo_bike` (`cardio`); no muscle scores |

The editor autosaves about 1 s after the last change ("saving…" → "saved"),
through `saveRoutine` → the `save_routine` RPC (all-or-nothing).

## Catalog

- Ids and patterns come from the digest (`exercise_id`, pattern). Glute
  work available: `hip_thrust` (barbell, band), `glute_bridge` (bodyweight,
  band), `single_leg_glute_bridge`, `romanian_deadlift` (barbell, dumbbell),
  `single_leg_rdl`, `deadlift`, `good_morning`, `back_extension`,
  `bulgarian_split_squat`, `step_up`, `lunge`, `side_lunge`,
  `wide_stance_squat`, `squat`, `goblet_squat`, `side_lying_hip_abduction`,
  `lateral_walk`, `clam_shell`, `fire_hydrant`, `donkey_kick`.
- Missing that might be worth adding at `/exercises` (role scores:
  primary 10 / secondary 7 / supporting 4 / stabilizer 2; ≤2 primary, ≤9
  muscles): seated/bent-knee calf raise (soleus), pogo hops / jump rope
  (elastic runner work), single-leg hip thrust, B-stance RDL, Cossack squat,
  single-leg balance. Suggest these; never add them by SQL.

## Programs, assignments, and the launcher

- A program is weeks × weekdays (1 = Mon … 7 = Sun) of routines. Weeks can
  differ (blocks), but usually repeat.
- An assignment = person + program + start date + status
  (active/paused/completed). One active assignment per person.
- **Launcher gotcha:** the home launcher pre-selects today's program day by
  weekday. With no program day today, or no active assignment, it defaults to
  **the routine the person did last**, so an off-program household repeats
  one routine forever. An assignment past the program's last week shows a
  "finished program" prompt.
- Care routines (`_care` id suffix or a "Care:" name) stay out of the daily
  picker and are offered as finishers.

## Applying changes through the UI (Chrome)

Use the dev server (`npm run dev`; reuse one already on :3000, never start a
second). Load the claude-in-chrome tools, open a new tab, and:

1. **New routine:** `/programs` → "New routine name" input → "New routine"
   → redirects to `/routines/<id>`. Set "Routine notes".
2. **Rows:** "Add exercise" → the picker (search, pick the exercise ×
   implement variant) → the new row opens; set Sets / Reps (Single/Range) or
   Seconds / Rest / Target RIR / Superset / Mode / Band role / Notes. Click a
   row's summary line to open or collapse it. Wait for "saved".
3. **New program:** `/programs` → "New program name" → "New program" →
   `/programs/<id>` with one week. Set notes; pick the routine in the
   "Week 1 Mon" (etc.) select; then "Week 1 actions" → "Duplicate week" until
   the length is right (each duplicate inserts after that week).
4. **Assign:** the program page's assignment form: "Person to assign" select,
   "Start date", then "Assign".

**Set values with `form_input`, not keystroke typing.** The editors
autosave on a debounce and re-render mid-typing, and typed text loses
characters ("hamstring" saved as "hmstring") while the dev overlay logs
"Maximum update depth exceeded" at the notes `onChange`. That was seen with
synthetic keystrokes and not investigated further. `form_input` on the textbox or
number input sets the whole value at once and React picks it up. Rep ranges:
click "Range" first, then set max before min. Batch repeated menu clicks
(e.g. seven "Duplicate week"s) with one `javascript_tool` loop.

**Avoid these while driving Chrome: they open a blocking `confirm()`
dialog.** Row menu → "Remove", "Delete routine", "Delete program", "Remove
week", and removing an assignment chip. If something must be removed, ask the
user to click it, or swap/reuse the row instead.

Verify by re-running the digest scoped to the person/program, and compare
with the `/programs/<id>` "Weekly muscle coverage" panel.
