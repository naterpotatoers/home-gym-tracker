import type { GymData } from "./gym-data";
import type { ClientId, WeighIn } from "./types";

/** One client's weigh-ins, ascending by date (tie-break id) — chart order.
 *  Pure and synchronous over `GymData`, like progress.ts. */
export function weighInHistory(data: GymData, clientId: ClientId): WeighIn[] {
  return data.weighIns
    .filter((w) => w.clientId === clientId)
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
}
