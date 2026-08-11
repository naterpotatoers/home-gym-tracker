import { buildGymData, type GymData } from "../gym-data";
import { careRoutineExercises, careRoutines } from "./care-routines";
import { clients, weighIns } from "./clients";
import {
  exerciseModalities,
  exerciseMuscleScores,
  exercises,
} from "./exercises";
import { foods } from "./foods";
import {
  assignments,
  programDays,
  programs,
  routineExercises,
  routines,
} from "./programs";
import { sessions, setLogs } from "./sessions";

/**
 * The TypeScript seed tables assembled into a GymData snapshot. Used by the
 * database seeder, and useful anywhere the pure query layer needs exercising
 * without a database (tests, one-off scripts).
 */
export function seedSnapshot(): GymData {
  return buildGymData({
    source: "seed",
    // Care routines append after the training fixtures so routines[0] stays
    // r_full_a for tests that lean on it.
    routines: [...routines, ...careRoutines],
    routineExercises: [...routineExercises, ...careRoutineExercises],
    programs,
    programDays,
    assignments,
    sessions,
    setLogs,
    weighIns,
    clientsSource: "seed",
    clients,
    exercisesSource: "seed",
    exercises,
    exerciseMuscleScores,
    exerciseModalities,
    // Fixture foods so the nutrition UI and its tests work without a
    // database; "database" here means "don't show the run-the-SQL note".
    nutritionSource: "database",
    foods,
    foodLogs: [],
  });
}
