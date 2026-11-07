import { describe, expect, it } from "vitest";
import { suggestFinishers } from "./care";
import { isCareRoutine } from "./data/care-routines";
import { seedSnapshot } from "./data/seed-snapshot";

const data = seedSnapshot();
const LEGS = ["r_knee_care", "r_hip_glute_care", "r_achilles_hamstring_care", "r_low_back_care"];
const UPPER = ["r_shoulder_care", "r_posture_care"];

describe("isCareRoutine", () => {
  it("matches the built-ins by id and hand-made ones by name", () => {
    expect(isCareRoutine({ id: "r_knee_care", name: "Knee" })).toBe(true);
    expect(isCareRoutine({ id: "r_custom", name: "Care: Wrists" })).toBe(true);
    expect(isCareRoutine({ id: "r_upper", name: "Upper A" })).toBe(false);
  });
});

describe("suggestFinishers", () => {
  it("offers lower-body care after a lower session", () => {
    const out = suggestFinishers(data, "s_nate_0715").map((r) => r.id);
    expect(out.length).toBeGreaterThan(0);
    expect(LEGS).toContain(out[0]);
  });

  it("offers upper-body care after an upper session", () => {
    const out = suggestFinishers(data, "s_nate_0727").map((r) => r.id);
    expect(out.length).toBeGreaterThan(0);
    expect(UPPER).toContain(out[0]);
  });

  it("returns nothing for an unknown session", () => {
    expect(suggestFinishers(data, "nope")).toEqual([]);
  });
});
