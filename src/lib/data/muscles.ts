import type { Muscle, MuscleGroup } from "../types";

export const muscleGroups: readonly MuscleGroup[] = [
  { id: "chest", label: "Chest", order: 1 },
  { id: "back", label: "Back", order: 2 },
  { id: "shoulders", label: "Shoulders", order: 3 },
  { id: "arms", label: "Arms", order: 4 },
  { id: "legs", label: "Legs", order: 5 },
  { id: "core", label: "Core", order: 6 },
];

/** Categorical identity hues for muscle groups — same palette family as
 *  CLIENT_COLORS, deliberately clear of the status green/yellow/red. Always
 *  paired with the group label; never the only encoding. */
export const MUSCLE_GROUP_COLORS: Record<import("../types").MuscleGroupId, string> = {
  chest: "#ec4899",
  back: "#3987e5",
  shoulders: "#f97316",
  arms: "#8b5cf6",
  legs: "#14b8a6",
  core: "#06b6d4",
};

export const muscles: readonly Muscle[] = [
  // chest
  { id: "upper_chest", name: "Upper Chest (Clavicular Pec)", groupId: "chest" },
  { id: "mid_chest", name: "Mid Chest (Sternal Pec)", groupId: "chest" },
  { id: "lower_chest", name: "Lower Chest (Costal Pec)", groupId: "chest" },
  // back
  { id: "lats", name: "Lats", groupId: "back" },
  { id: "traps", name: "Traps", groupId: "back" },
  { id: "rhomboids", name: "Rhomboids / Mid Back", groupId: "back" },
  { id: "lower_back", name: "Lower Back (Erectors)", groupId: "back" },
  // shoulders
  { id: "front_delts", name: "Front Delts", groupId: "shoulders" },
  { id: "side_delts", name: "Side Delts", groupId: "shoulders" },
  { id: "rear_delts", name: "Rear Delts", groupId: "shoulders" },
  // Stabilizers that free-weight and unilateral work emphasize and machines
  // take over. Tracked explicitly so the modality modifiers show up in the
  // volume heatmap instead of hiding inside a single stabilityDemand scalar.
  { id: "rotator_cuff", name: "Rotator Cuff", groupId: "shoulders" },
  { id: "serratus", name: "Serratus Anterior", groupId: "shoulders" },
  // arms
  { id: "biceps", name: "Biceps", groupId: "arms" },
  { id: "triceps", name: "Triceps", groupId: "arms" },
  { id: "forearms", name: "Forearms / Grip", groupId: "arms" },
  // legs
  { id: "quads", name: "Quads", groupId: "legs" },
  { id: "hamstrings", name: "Hamstrings", groupId: "legs" },
  { id: "glutes", name: "Glutes (Max)", groupId: "legs" },
  { id: "glute_med", name: "Glute Med (Hip Abductors)", groupId: "legs" },
  { id: "adductors", name: "Adductors (Inner Thigh)", groupId: "legs" },
  { id: "calves", name: "Calves", groupId: "legs" },
  { id: "hip_flexors", name: "Hip Flexors", groupId: "legs" },
  // core
  { id: "abs", name: "Abdominals", groupId: "core" },
  { id: "obliques", name: "Obliques", groupId: "core" },
];

export const muscleById = new Map(muscles.map((m) => [m.id, m]));
export const muscleGroupById = new Map(muscleGroups.map((g) => [g.id, g]));
