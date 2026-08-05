import { describe, expect, it } from "vitest";
import { isExerciseId, isModalityId, isSessionCondition } from "./validate";

describe("write-path FK guards", () => {
  it("accepts known reference ids", () => {
    expect(isExerciseId("squat")).toBe(true);
    expect(isExerciseId("bird_dog")).toBe(true);
    expect(isModalityId("barbell")).toBe(true);
    expect(isSessionCondition("good")).toBe(true);
  });

  it("rejects unknown or stale ids", () => {
    expect(isExerciseId("reverse_dead_bug")).toBe(false); // renamed to bird_dog
    expect(isExerciseId("")).toBe(false);
    expect(isModalityId("kettlebell")).toBe(false);
    expect(isSessionCondition("meh")).toBe(false);
  });
});
