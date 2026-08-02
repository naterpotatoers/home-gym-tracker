import { buildGymData, type GymData } from "../gym-data";
import { weighIns } from "./clients";
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
    routines,
    routineExercises,
    programs,
    programDays,
    assignments,
    sessions,
    setLogs,
    weighIns,
  });
}
