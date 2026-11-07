import { describe, expect, it } from "vitest";
import { seedSnapshot } from "./data/seed-snapshot";
import { availableVariants } from "./queries";
import { swapSuggestions } from "./similar";

const data = seedSnapshot();
const variants = availableVariants(data);

function defaultModality(exerciseId: string) {
  const em = data.exerciseModalities.find((m) => m.exerciseId === exerciseId && m.isDefault);
  if (!em) throw new Error(`seed data changed: no default variant for ${exerciseId}`);
  return em.modalityId;
}

describe("swapSuggestions", () => {
  it("offers the same movement on other equipment first", () => {
    const out = swapSuggestions(data, variants, { exerciseId: "bent_over_row", modalityId: "barbell" });
    expect(out[0]).toMatchObject({ kind: "equipment" });
    expect(out[0].variant.exerciseModality).toMatchObject({
      exerciseId: "bent_over_row",
      modalityId: "dumbbell",
    });
  });

  it("suggests other horizontal pulls for a row", () => {
    const out = swapSuggestions(data, variants, { exerciseId: "bent_over_row", modalityId: "barbell" });
    const similar = out.filter((s) => s.kind === "similar").map((s) => s.variant.exerciseModality.exerciseId);
    expect(similar.some((id) => ["single_arm_row", "chest_supported_row", "inverted_row"].includes(id))).toBe(true);
  });

  it("ranks pulling work at the top for a pull-up", () => {
    const out = swapSuggestions(data, variants, { exerciseId: "pull_up", modalityId: defaultModality("pull_up") });
    const similar = out.filter((s) => s.kind === "similar");
    expect(similar.length).toBeGreaterThan(0);
    for (const s of similar.slice(0, 3)) expect(["pull_v", "pull_h"]).toContain(s.variant.pattern);
    expect(similar[0].reason).toMatch(/lats/);
  });

  it("never suggests the source variant or crosses into mobility", () => {
    for (const exerciseId of ["squat", "pull_up", "bent_over_row"]) {
      const modalityId = defaultModality(exerciseId);
      for (const s of swapSuggestions(data, variants, { exerciseId, modalityId })) {
        expect(
          s.variant.exerciseModality.exerciseId === exerciseId &&
            s.variant.exerciseModality.modalityId === modalityId,
        ).toBe(false);
        expect(s.variant.pattern).not.toBe("mobility");
      }
    }
  });
});
