import { describe, expect, it } from "vitest";
import { SEED_EXERCISE_CUES } from "./data/exercise-cues";
import { exercises } from "./data/exercises";
import { seedSnapshot } from "./data/seed-snapshot";
import { catalogSlice, MAX_CUE_LENGTH, MAX_CUE_WORDS, MAX_CUES } from "./exercise-catalog";
import { exerciseInfo } from "./exercise-info";
import { parseCues } from "./names";

describe("built-in cues", () => {
  it("cover exactly the seed exercises, 1–3 short cues of ≤12 words each", () => {
    expect(Object.keys(SEED_EXERCISE_CUES).sort()).toEqual(exercises.map((e) => e.id).sort());
    for (const [id, cues] of Object.entries(SEED_EXERCISE_CUES)) {
      expect(cues.length, id).toBeGreaterThanOrEqual(1);
      expect(cues.length, id).toBeLessThanOrEqual(MAX_CUES);
      for (const cue of cues) {
        expect(cue.length, `${id}: ${cue}`).toBeLessThanOrEqual(MAX_CUE_LENGTH);
        const words = cue.split(/\s+/).filter((w) => /\w/.test(w)).length;
        expect(words, `${id}: ${cue}`).toBeLessThanOrEqual(MAX_CUE_WORDS);
        expect(parseCues([cue]), cue).toEqual([cue]); // already normalized
      }
      expect(new Set(cues.map((c) => c.toLowerCase())).size, id).toBe(cues.length);
    }
  });

  it("are merged into the seed catalog", () => {
    expect(exercises.find((e) => e.id === "squat")?.cues).toEqual(SEED_EXERCISE_CUES.squat);
  });
});

describe("parseCues", () => {
  it("trims, collapses spaces, drops empties and case-insensitive repeats", () => {
    expect(parseCues(["  Brace   hard. ", "", "brace hard.", "Knees out."])).toEqual(["Brace hard.", "Knees out."]);
  });
});

describe("exerciseInfo", () => {
  const catalog = catalogSlice(seedSnapshot());

  it("names what a variant works, best first, with cues and a demo search", () => {
    const info = exerciseInfo(catalog, "squat", "barbell")!;
    expect(info.name).toBe("Squat");
    expect(info.cues).toEqual(SEED_EXERCISE_CUES.squat);
    expect(info.primary).toContain("Quads");
    expect(info.scores.map(([, s]) => s)).toEqual([...info.scores.map(([, s]) => s)].sort((a, b) => b - a));
    expect(info.demoUrl).toBe("https://www.youtube.com/results?search_query=Barbell%20Squat%20proper%20form");
  });

  it("Works = primary role, Also = secondary role (the editor's bands); the variant's own note", () => {
    const info = exerciseInfo(catalog, "squat", "barbell")!;
    expect(info.secondary).toContain("Glutes (Max)"); // squat scores glutes 7
    expect(info.primary).not.toContain("Glutes (Max)");
    expect(exerciseInfo(catalog, "dip", "band")?.variantNotes).toBe("Band loops across the dip bars to unload bodyweight.");
    expect(exerciseInfo(catalog, "dip", "bodyweight")?.variantNotes).toBe("");
  });

  it("mobility and the bike have no muscle map; unknown ids are null", () => {
    expect(exerciseInfo(catalog, "cat_cow", "bodyweight")?.scores).toEqual([]);
    expect(exerciseInfo(catalog, "echo_bike", "cardio")?.demoUrl).toContain("search_query=Echo%20Bike%20proper%20form");
    expect(exerciseInfo(catalog, "nope", "barbell")).toBeNull();
  });
});
