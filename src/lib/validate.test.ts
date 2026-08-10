import { describe, expect, it } from "vitest";
import {
  isBandRole,
  isEquipmentId,
  isMetricType,
  isModalityId,
  isMovementPattern,
  isMuscleId,
  isSessionCondition,
  isUnilateralMode,
} from "./validate";

describe("write-path FK guards", () => {
  it("accepts known reference ids", () => {
    expect(isModalityId("barbell")).toBe(true);
    expect(isSessionCondition("good")).toBe(true);
    expect(isMuscleId("lats")).toBe(true);
    expect(isEquipmentId("rack")).toBe(true);
    expect(isMovementPattern("pull_h")).toBe(true);
    expect(isMetricType("time")).toBe(true);
    expect(isBandRole("assistance")).toBe(true);
    expect(isUnilateralMode("single_side")).toBe(true);
  });

  it("rejects unknown or stale ids", () => {
    expect(isModalityId("kettlebell")).toBe(false);
    expect(isSessionCondition("meh")).toBe(false);
    expect(isMuscleId("delts")).toBe(false); // split into front/side/rear
    expect(isMuscleId("")).toBe(false);
    expect(isEquipmentId("cable_stack")).toBe(false);
    expect(isMovementPattern("push")).toBe(false);
    expect(isMetricType("weight")).toBe(false);
    expect(isBandRole("support")).toBe(false);
    expect(isUnilateralMode("unilateral")).toBe(false);
  });
});
