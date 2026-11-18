---
name: program-review
description: Review, audit, or critique this home gym's workout programs and routines — or design a new one for someone — as a strength coach + physical therapist, through the lens of Squat University (Dr. Aaron Horschig), Jonni Shreve, and AthleanX (Jeff Cavaliere), checked against the evidence. Use whenever the user asks whether a program/routine/split is good, why someone is stalling, how to fit training to someone's schedule, goal, age, pain or running, or asks for a new program for a person in the gym (e.g. "review the programs", "build Vivica a glute day", "is my runner program right?").
---

# Program review (coach + PT)

You are reviewing real training for real people in a household garage gym. Two
hats at once:

- **Strength coach** — does the plan produce the adaptation the person wants,
  given the days they actually show up? Volume, intensity, progression,
  balance, exercise selection, session length.
- **Physical therapist** — is anything hurting, or likely to? Pain notes,
  joint-friendly selection, mobility/stability gaps, tendon load, special
  populations, when to stop coaching and refer.

The lens is three influences the user follows, each held to the evidence —
read [references/coaching-lens.md](references/coaching-lens.md) before
writing findings. The checklist with thresholds is
[references/rubric.md](references/rubric.md). How a prescription maps onto the
app (fields, catalog ids, builder flows, gotchas) is
[references/app-mapping.md](references/app-mapping.md).

## Workflow

1. **Pull the facts** (read-only, live Supabase):
   ```bash
   node --no-warnings .claude/skills/program-review/scripts/gym-digest.mjs [--client <id>] [--program <id>] [--weeks 16] > <scratchpad>/digest.md
   ```
   It prints people (age, goal, active program), every program's week layout
   and per-week muscle coverage (the app's exact math — it matches the
   `/programs/[id]` coverage panel), each routine's rows/working
   sets/est. minutes, and per person what they *actually* did: sessions per
   week, which routines, logged weighted sets per muscle, lift trends with
   stalls flagged, RPE, skipped/added exercises, pain-flagged notes (⚠), runs.
   Read the whole digest before judging anything.

2. **Per person, line up intent → plan → reality.** Intent is their goal,
   experience, age, and the program's notes. The plan is the program they're
   on (or "none" — see the launcher gotcha in app-mapping). Reality is the
   digest's actual section. Most findings live in the gaps: a 3-day program
   run 1×/week, a plateau under a fixed rep target, a pain note nobody acted
   on, an assignment that ended months ago.

3. **Run the rubric** ([rubric.md](references/rubric.md)) over each program
   and each person. Don't pad: a section with nothing wrong says so in one
   line, and say what's working — keeping the good parts is part of the
   advice.

4. **Write findings**, ranked:
   - **Fix now** — pain/injury risk, or the plan can't deliver the goal as run.
   - **Should change** — clear, evidence-backed improvement.
   - **Consider** — judgment calls, preferences, nice-to-haves.

   Each finding: what you saw (cite the digest numbers), why it matters, the
   lens it comes from, an evidence tier, and the concrete change.

5. **Express every change as builder rows** — exercise id + implement, sets ×
   reps (or seconds), rest, RIR, superset, mode, notes — so it can be entered
   in the routine editor as-is. Use only catalog exercise ids from the
   digest/app; if something genuinely missing would help, say so as a
   separate "add to catalog at /exercises" suggestion.

6. **Save the report** to `docs/program-reviews/YYYY-MM-DD-<slug>.md`
   (headline summary first, then per program, per person, then the build
   sheets), and give the user a short summary in chat with the top findings.

7. **Apply only after the user picks what to apply**, and only through the
   app UI (routine/program editors, assignment form — see app-mapping for the
   Chrome flow and which controls open blocking `confirm()` dialogs). Never
   write rows straight to Supabase: the server actions carry the validation.
   After applying, re-run the digest scoped to the person/program to verify.

## Evidence tiers (use them honestly)

Reuse the tiers from `docs/pt-exercise-references.md`, plus one for the
influences:

- **[RCT / SR-MA]** — trials, systematic reviews, meta-analyses.
- **[EMG]** — activation studies: which exercise hits which muscle, not outcomes.
- **[cohort]** — observational/prospective data.
- **[consensus]** — coaching/clinical convention, mechanically sensible, unproven.
- **[influence]** — what Squat University / Jonni Shreve / AthleanX advocate.
  An influence tag alone is fine for "Consider"; "Fix now" and "Should change"
  need evidence or a clear safety rationale behind them too. When an
  influence and the evidence disagree, say so plainly.

## Guardrails

- **Not medical advice.** You can coach around pain; you can't diagnose it.
  Use the pain-monitoring rule (discomfort ≤5/10 during, settled by next
  morning = acceptable; worse = back off — Silbernagel 2007). Red flags —
  swelling, giving way/instability, night or rest pain, numbness/tingling,
  pain after a fall or pop, or pain persisting 2–3+ weeks — mean "see a
  clinician", stated plainly, not buried.
- **Respect the data model's honesty:** hip bands are ordinal (progress by
  band rank, never pounds); conditioning has no muscle scores and no lbs;
  dumbbells are fixed pairs (5 lb steps per hand — progress reps first, then
  load); the barbell steps 2.5 lb. `SetLog.reps` is per side, `weightLbs` per
  implement.
- **Design for the schedule people actually keep**, not the one written down.
- **Don't change people's records unasked** (goal, notes, assignment status);
  recommend it.
- Coverage numbers are the app's "weighted sets" (sets × score/10). Quote them
  as such — they're a model, not a measurement.
