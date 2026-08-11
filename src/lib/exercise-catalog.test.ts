import { describe, expect, it } from "vitest";
import {
  exerciseModalities,
  exerciseMuscleScores,
  exercises,
} from "./data/exercises";
import {
  exerciseLookup,
  findNameCollision,
  MAX_ALIASES,
  MAX_PRIMARY_MUSCLES,
  MAX_SCORED_MUSCLES,
  roleForScore,
  scoreForRole,
} from "./exercise-catalog";
import { nameKey } from "./names";

const catalog = { exercises, exerciseMuscleScores, exerciseModalities };
const { exerciseById, scoresByExercise, modalitiesByExercise } =
  exerciseLookup(catalog);

describe("seed catalog integrity", () => {
  it("every non-mobility exercise has at least one muscle score", () => {
    const unscored = exercises
      .filter((e) => e.pattern !== "mobility")
      .filter((e) => (scoresByExercise.get(e.id) ?? []).length === 0);
    expect(unscored.map((e) => e.id)).toEqual([]);
  });

  it("mobility exercises carry no scores (excluded from volume on purpose)", () => {
    const scored = exercises
      .filter((e) => e.pattern === "mobility")
      .filter((e) => (scoresByExercise.get(e.id) ?? []).length > 0);
    expect(scored.map((e) => e.id)).toEqual([]);
  });

  it("every exercise has exactly one default variant", () => {
    for (const exercise of exercises) {
      const variants = modalitiesByExercise.get(exercise.id) ?? [];
      expect(variants.length, `${exercise.id} has no variants`).toBeGreaterThan(0);
      expect(
        variants.filter((v) => v.isDefault).length,
        `${exercise.id} default count`,
      ).toBe(1);
    }
  });

  it("band roles appear only on band variants", () => {
    const offenders = exerciseModalities.filter(
      (em) => em.bandRoles.length > 0 && em.modalityId !== "band",
    );
    expect(offenders).toEqual([]);
  });

  it("every score row points at a real exercise and stays in 0-10", () => {
    for (const row of exerciseMuscleScores) {
      expect(exerciseById.has(row.exerciseId), row.exerciseId).toBe(true);
      expect(row.score).toBeGreaterThanOrEqual(0);
      expect(row.score).toBeLessThanOrEqual(10);
    }
  });

  it("seed profiles stay inside the authoring guardrails", () => {
    for (const exercise of exercises) {
      const scores = scoresByExercise.get(exercise.id) ?? [];
      expect(scores.length, exercise.id).toBeLessThanOrEqual(MAX_SCORED_MUSCLES);
      const primaries = scores.filter((s) => s.score >= 9).length;
      expect(primaries, `${exercise.id} primaries`).toBeLessThanOrEqual(
        MAX_PRIMARY_MUSCLES,
      );
    }
  });

  it("includes inverted row with a rack bodyweight variant", () => {
    expect(exerciseById.get("inverted_row")?.pattern).toBe("pull_h");
    const variants = modalitiesByExercise.get("inverted_row") ?? [];
    expect(variants).toHaveLength(1);
    expect(variants[0].modalityId).toBe("bodyweight");
    expect(variants[0].requiredEquipment).toContain("rack");
    expect((scoresByExercise.get("inverted_row") ?? []).length).toBeGreaterThan(0);
  });
});

/** Score for a muscle on an exercise, 0 when unscored. */
function scoreOf(exerciseId: string, muscleId: string): number {
  return (
    (scoresByExercise.get(exerciseId) ?? []).find((s) => s.muscleId === muscleId)
      ?.score ?? 0
  );
}

describe("cross-variant score orderings (EMG literature)", () => {
  // Each assertion encodes a conclusion from the cited studies in
  // data/exercises.ts — a future re-tune that silently breaks one fails here.
  const orderings: [muscle: string, higher: string, lower: string][] = [
    // Contreras 2015 / Andersen 2018: loaded hip extension out-glutes squats.
    // (hip_thrust and deadlift tie at the 10 ceiling — both "very high" in
    // Neto 2020 — so only the vs-squat orderings are strict.)
    ["glutes", "hip_thrust", "squat"],
    ["glutes", "deadlift", "squat"],
    // Neto 2020: loaded hip extension >> bodyweight bridges/quadruped.
    ["glutes", "hip_thrust", "glute_bridge"],
    ["glutes", "hip_thrust", "donkey_kick"],
    // McAllister 2014 / Andersen 2018: RDL owns hamstrings; squat hamstring
    // EMG is co-contraction, not work (Wright 1999).
    ["hamstrings", "romanian_deadlift", "deadlift"],
    ["hamstrings", "deadlift", "hip_thrust"],
    ["hamstrings", "lunge", "squat"],
    // Front-rack trunk demand (and NOT lower erector work — Yavuz 2015).
    ["abs", "front_squat", "squat"],
    // Lauver 2016 / Rodríguez-Ridao 2020: incline shifts, flat still trains
    // the clavicular head.
    ["upper_chest", "incline_bench_press", "bench_press"],
    ["mid_chest", "bench_press", "incline_bench_press"],
    // Botton 2020: lateral raise is the medial-delt exercise.
    ["side_delts", "lateral_raise", "shoulder_press"],
    // McKenzie 2022: bar dip > bench dip for pec.
    ["lower_chest", "dip", "bench_dip"],
    // Youdas 2010: grip flips biceps and lower-trap emphasis.
    ["biceps", "chin_up", "pull_up"],
    ["traps", "pull_up", "chin_up"],
    // Fenwick 2009: only the unsupported row loads the erectors.
    ["lower_back", "bent_over_row", "chest_supported_row"],
    // Distefano 2009: lateral band walk > clam for glute med.
    ["glute_med", "lateral_walk", "clam_shell"],
    // Straight legs lengthen the lever (Escamilla 2006).
    ["hip_flexors", "hanging_leg_raise", "hanging_knee_raise"],
    // PT additions. Ludewig 2004: the protraction "plus" is what makes the
    // serratus work — a regular push-up is the lesser serratus exercise.
    ["serratus", "scapular_push_up", "push_up"],
    // Distefano 2009 hierarchy. (side_lying_hip_abduction deliberately TIES
    // lateral_walk at the 10 ceiling, like hip_thrust/deadlift for glutes —
    // only vs-clam orderings are strict.)
    ["glute_med", "side_lying_hip_abduction", "clam_shell"],
    // Reinold 2007: full-can loads the supraspinatus; lateral raise merely
    // involves it.
    ["rotator_cuff", "scaption_raise", "lateral_raise"],
    // Side-lying ER remains the targeted cuff move (Reinold 2004).
    ["rotator_cuff", "external_rotation", "band_internal_rotation"],
    // Nordic ties the RDL hamstring ceiling; both clear the unilateral RDL
    // (Bourne 2017).
    ["hamstrings", "nordic_curl", "single_leg_rdl"],
    ["hamstrings", "romanian_deadlift", "single_leg_rdl"],
    // One-sided load is the oblique carry (McGill 2009).
    ["obliques", "suitcase_carry", "farmer_carry"],
    // McGill curl-up is deliberately sub-maximal and spine-sparing.
    ["abs", "sit_up", "mcgill_curl_up"],
    // Band TKE's load ceiling sits under the isometric wall sit.
    ["quads", "wall_sit", "band_tke"],
  ];

  it.each(orderings)("%s: %s > %s", (muscle, higher, lower) => {
    expect(scoreOf(higher, muscle)).toBeGreaterThan(scoreOf(lower, muscle));
  });

  it("copenhagen plank is the catalog's adductor ceiling (Serner 2014)", () => {
    const ceiling = scoreOf("copenhagen_plank", "adductors");
    expect(ceiling).toBe(10);
    for (const exercise of exercises) {
      if (exercise.id === "copenhagen_plank") continue;
      expect(scoreOf(exercise.id, "adductors"), exercise.id).toBeLessThan(ceiling);
    }
  });

  it("stance width does not change quad emphasis (Escamilla 2001, Paoli 2009)", () => {
    expect(
      Math.abs(scoreOf("squat", "quads") - scoreOf("wide_stance_squat", "quads")),
    ).toBeLessThanOrEqual(1);
    expect(Math.abs(scoreOf("squat", "quads") - scoreOf("front_squat", "quads"))).toBe(0);
  });

  it("farmer carry variants stay score-identical (same movement, different metric)", () => {
    const key = (rows: { muscleId: string; score: number }[]) =>
      rows.map((r) => `${r.muscleId}:${r.score}`).sort().join(",");
    expect(key(scoresByExercise.get("timed_carry") ?? [])).toBe(
      key(scoresByExercise.get("farmer_carry") ?? []),
    );
  });
});

describe("names and aliases", () => {
  it("no two seed exercises share a name or alias (normalized)", () => {
    const owners = new Map<string, string>();
    for (const exercise of exercises) {
      for (const known of [exercise.name, ...(exercise.aliases ?? [])]) {
        const key = nameKey(known);
        const owner = owners.get(key);
        expect(owner, `"${known}" on both ${owner} and ${exercise.id}`).toBe(
          undefined,
        );
        owners.set(key, exercise.id);
      }
    }
  });

  it("seed alias lists stay within the authoring cap", () => {
    for (const exercise of exercises) {
      expect((exercise.aliases ?? []).length, exercise.id).toBeLessThanOrEqual(
        MAX_ALIASES,
      );
    }
  });

  it("nameKey trims, collapses spaces, and lowercases", () => {
    expect(nameKey("  Overhead   Press ")).toBe("overhead press");
    expect(nameKey("SHOULDER PRESS")).toBe("shoulder press");
  });

  it("findNameCollision matches names and aliases, and excludes self", () => {
    const hit = findNameCollision(exercises, [nameKey("overhead  PRESS")]);
    expect(hit?.exercise.id).toBe("shoulder_press");
    expect(hit?.matched).toBe("Overhead Press");

    const byName = findNameCollision(exercises, [nameKey("Front Squat")]);
    expect(byName?.exercise.id).toBe("front_squat");

    expect(
      findNameCollision(exercises, [nameKey("Front Squat")], "front_squat"),
    ).toBe(null);
    expect(findNameCollision(exercises, [nameKey("Zercher Squat")])).toBe(
      null,
    );
  });
});

describe("score roles", () => {
  it("round-trips role values", () => {
    for (const role of ["primary", "secondary", "supporting", "stabilizer"] as const) {
      expect(roleForScore(scoreForRole(role))).toBe(role);
    }
  });

  it("maps seed scores to sensible roles", () => {
    expect(roleForScore(10)).toBe("primary");
    expect(roleForScore(9)).toBe("primary");
    expect(roleForScore(8)).toBe("secondary");
    expect(roleForScore(6)).toBe("secondary");
    expect(roleForScore(5)).toBe("supporting");
    expect(roleForScore(3)).toBe("supporting");
    expect(roleForScore(2)).toBe("stabilizer");
    expect(roleForScore(1)).toBe("stabilizer");
  });
});
