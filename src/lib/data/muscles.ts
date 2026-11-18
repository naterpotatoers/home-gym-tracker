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
 *  paired with the group label; never the only encoding. Values are CSS
 *  vars (the hexes live in globals.css), so use them as CSS, not in math. */
export const MUSCLE_GROUP_COLORS: Record<import("../types").MuscleGroupId, string> = {
  chest: "var(--group-chest)",
  back: "var(--group-back)",
  shoulders: "var(--group-shoulders)",
  arms: "var(--group-arms)",
  legs: "var(--group-legs)",
  core: "var(--group-core)",
};

export const muscles: readonly Muscle[] = [
  // chest
  { id: "upper_chest", name: "Upper Chest (Clavicular Pec)", groupId: "chest",
    about: "Upper pec — lifts the arm up and across; incline presses and low-to-high flys hit it." },
  { id: "mid_chest", name: "Mid Chest (Sternal Pec)", groupId: "chest",
    about: "The bulk of the pec — pushes the arm forward and hugs it across the body." },
  { id: "lower_chest", name: "Lower Chest (Costal Pec)", groupId: "chest",
    about: "Lower pec fibers — pull the arm down and across; dips and decline presses bias them." },
  // back
  { id: "lats", name: "Lats", groupId: "back",
    about: "Biggest back muscle — pulls the arm down and back; you feel it under the armpit." },
  { id: "traps", name: "Traps", groupId: "back",
    about: "Neck to mid-back — shrugs, pulls the shoulder blades together and rotates them up overhead." },
  { id: "rhomboids", name: "Rhomboids / Mid Back", groupId: "back",
    about: "Between the shoulder blades — squeezes them together and down for every row." },
  { id: "lower_back", name: "Lower Back (Erectors)", groupId: "back",
    about: "Spinal erectors — keep the spine straight under load and extend it from a bend." },
  // shoulders
  { id: "front_delts", name: "Front Delts", groupId: "shoulders",
    about: "Front of the shoulder — raises the arm forward; works hard in every press." },
  { id: "side_delts", name: "Side Delts", groupId: "shoulders",
    about: "Outside of the shoulder — lifts the arm out to the side; builds shoulder width." },
  { id: "rear_delts", name: "Rear Delts", groupId: "shoulders",
    about: "Back of the shoulder — pulls the arm back and out; face pulls and rows." },
  // Stabilizers that free-weight and unilateral work emphasize and machines
  // take over. Tracked explicitly so the modality modifiers show up in the
  // volume heatmap instead of hiding inside a single stabilityDemand scalar.
  { id: "rotator_cuff", name: "Rotator Cuff", groupId: "shoulders",
    about: "Four small muscles holding the ball in the socket — rotation and shoulder health." },
  { id: "serratus", name: "Serratus Anterior", groupId: "shoulders",
    about: "Along the ribs under the armpit — wraps the shoulder blade forward and keeps it flat." },
  // arms
  { id: "biceps", name: "Biceps", groupId: "arms",
    about: "Front of the upper arm — bends the elbow and turns the palm up." },
  { id: "triceps", name: "Triceps", groupId: "arms",
    about: "Back of the upper arm — straightens the elbow; two-thirds of the arm's size." },
  { id: "forearms", name: "Forearms / Grip", groupId: "arms",
    about: "Wrist and finger muscles — grip, and the reason carries and heavy pulls get hard." },
  // legs
  { id: "quads", name: "Quads", groupId: "legs",
    about: "Front of the thigh — straightens the knee; squats, lunges and step-ups." },
  { id: "hamstrings", name: "Hamstrings", groupId: "legs",
    about: "Back of the thigh — bends the knee and drives the hips forward in a hinge." },
  { id: "glutes", name: "Glutes (Max)", groupId: "legs",
    about: "The big hip extensor — stands you up from a squat, hinge or bridge." },
  { id: "glute_med", name: "Glute Med (Hip Abductors)", groupId: "legs",
    about: "Side of the hip — holds the pelvis level on one leg and keeps the knee from caving." },
  { id: "adductors", name: "Adductors (Inner Thigh)", groupId: "legs",
    about: "Inner thigh — pulls the legs together and helps out of the bottom of a squat." },
  { id: "calves", name: "Calves", groupId: "legs",
    about: "Back of the lower leg — points the foot; every step, jump and calf raise." },
  { id: "tibialis", name: "Tibialis (Shin)", groupId: "legs",
    about: "Front of the shin — lifts the toes; protects the shins and knees when running." },
  { id: "hip_flexors", name: "Hip Flexors", groupId: "legs",
    about: "Deep front of the hip — lifts the knee toward the chest; tight from sitting." },
  // core
  { id: "abs", name: "Abdominals", groupId: "core",
    about: "Front of the trunk — braces the spine and curls the ribs toward the hips." },
  { id: "obliques", name: "Obliques", groupId: "core",
    about: "Sides of the trunk — rotate and side-bend, and resist both." },
];

export const muscleById = new Map(muscles.map((m) => [m.id, m]));
