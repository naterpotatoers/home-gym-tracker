import { describe, expect, it } from "vitest";
import {
  exerciseModalities,
  exerciseMuscleScores,
  exercises,
} from "./data/exercises";
import {
  exerciseLookup,
  MAX_PRIMARY_MUSCLES,
  MAX_SCORED_MUSCLES,
  roleForScore,
  scoreForRole,
} from "./exercise-catalog";

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
