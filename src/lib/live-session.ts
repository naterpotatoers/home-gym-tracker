import { finisherOptions, type FinisherOption } from "./care";
import { bikePast, type BikePast } from "./conditioning";
import { variantKey } from "./exercise-catalog";
import type { GymData } from "./gym-data";
import { recentVariantHistory, type VariantSessionSummary } from "./progress";
import { stallFor, type StallHint } from "./progression";
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
  /** This person's past bike pieces with an average, newest first (this
   *  session excluded) — a bike card's "Last" line and "+12 W vs" note. */
  bikeHistory: BikePast[];
  /** The session was already completed when the page rendered. */
  finished: boolean;
  /** "Continue your workout?" add-ons, suggested first (planned only). */
  finishers: FinisherOption[];
  /** Stalled lifts in this session, per "exerciseId|modalityId" (planned
   *  only) — the runner's "stalled" chip and callout. */
  stalls: Record<string, StallHint>;
};

/** The parts of a live view the server derives from the session's set list
 *  — refreshed by the runner (getLiveExtras) after a swap or add changes
 *  which variants the session trains, since set saves don't re-render. */
export type LiveExtras = Pick<LivePerson, "finishers" | "stalls">;

export function liveExtras(data: GymData, session: Session): LiveExtras {
  return {
    finishers: session.status === "planned" ? finisherOptions(data, session.id) : [],
    stalls: sessionStalls(data, session),
  };
}

/** Each working variant in a planned session that has stalled for this
 *  person, as of the session's date (the session itself excluded). */
function sessionStalls(data: GymData, session: Session) {
  const stalls: Record<string, StallHint> = {};
  if (session.status !== "planned") return stalls;
  for (const set of data.setsBySession.get(session.id) ?? []) {
    const key = variantKey(set.exerciseId, set.modalityId);
    if (set.isWarmup || key in stalls) continue;
    const hint = stallFor(data, session.clientId, set, session.date, session.id);
    if (hint) stalls[key] = hint;
  }
  return stalls;
}

export function livePerson(data: GymData, session: Session): LivePerson {
  const client = data.clientById.get(session.clientId);
  const prescriptions = session.routineId ? (data.exercisesByRoutine.get(session.routineId) ?? []) : [];
  return {
    session,
    initialSets: data.setsBySession.get(session.id) ?? [],
    prescriptions,
    clientName: client?.firstName ?? session.clientId,
    routineName: data.routineById.get(session.routineId ?? "")?.name ?? "Session",
    color: client?.color ?? null,
    recentKeys: recentVariantKeys(data, session.clientId),
    history: recentVariantHistory(data, session.clientId, session.id),
    bikeHistory: bikePast(data, session.clientId, session.id),
    finished: session.status === "completed",
    ...liveExtras(data, session),
  };
}
