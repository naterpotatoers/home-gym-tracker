import { finisherOptions, type FinisherOption } from "./care";
import type { GymData } from "./gym-data";
import { recentVariantHistory, type VariantSessionSummary } from "./progress";
import { recentVariantKeys } from "./queries";
import type { RoutineExercise, Session, SetLog } from "./types";

/** Everything a live session view (solo runner or group-board card) needs
 *  about one person's session — plain data, safe to cross to the client. */
export type LivePerson = {
  session: Session;
  initialSets: SetLog[];
  prescriptions: RoutineExercise[];
  clientName: string;
  routineName: string;
  /** Preset swatch hex from the person's profile — tints their card. */
  color: string | null;
  /** This person's recently trained variants, for the picker's Recent group. */
  recentKeys: string[];
  /** Last sessions per variant, for each block's "Last" line. */
  history: Record<string, VariantSessionSummary[]>;
  /** The session was already completed when the page rendered. */
  finished: boolean;
  /** "Continue your workout?" add-ons, suggested first (planned only). */
  finishers: FinisherOption[];
};

export function livePerson(data: GymData, session: Session): LivePerson {
  const client = data.clientById.get(session.clientId);
  return {
    session,
    initialSets: data.setsBySession.get(session.id) ?? [],
    prescriptions: session.routineId ? (data.exercisesByRoutine.get(session.routineId) ?? []) : [],
    clientName: client?.firstName ?? session.clientId,
    routineName: data.routineById.get(session.routineId ?? "")?.name ?? "Session",
    color: client?.color ?? null,
    recentKeys: recentVariantKeys(data, session.clientId),
    history: recentVariantHistory(data, session.clientId, session.id),
    finished: session.status === "completed",
    finishers: session.status === "planned" ? finisherOptions(data, session.id) : [],
  };
}
