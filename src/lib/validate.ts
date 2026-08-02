import { clients } from "./data/clients";
import { bands } from "./data/equipment";
import { exercises } from "./data/exercises";
import { modalities } from "./data/modalities";
import type {
  BandId,
  ClientId,
  ExerciseId,
  ModalityId,
  SessionCondition,
} from "./types";

/**
 * The database stores foreign keys into reference data as plain text — the id
 * unions only exist at compile time. Server actions run these guards before
 * writing so a malformed request cannot insert a dangling reference.
 */
const exerciseIds = new Set<string>(exercises.map((e) => e.id));
const modalityIds = new Set<string>(modalities.map((m) => m.id));
const clientIds = new Set<string>(clients.map((c) => c.id));
const bandIds = new Set<string>(bands.map((b) => b.id));

export function isExerciseId(id: string): id is ExerciseId {
  return exerciseIds.has(id);
}

export function isModalityId(id: string): id is ModalityId {
  return modalityIds.has(id);
}

export function isClientId(id: string): id is ClientId {
  return clientIds.has(id);
}

export function isBandId(id: string): id is BandId {
  return bandIds.has(id);
}

const conditions = new Set<string>(["rough", "tired", "normal", "good", "great"]);

export function isSessionCondition(value: string): value is SessionCondition {
  return conditions.has(value);
}
