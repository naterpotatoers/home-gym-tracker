import { MUSCLE_GROUP_COLORS } from "./data/muscles";
import type { GymData } from "./gym-data";
import { defaultClientId } from "./queries";
import type { MuscleGroupId } from "./types";
import { isModalityId } from "./validate";

function isMuscleGroupId(value: string): value is MuscleGroupId {
  return value in MUSCLE_GROUP_COLORS;
}

/** The Progress page's full URL state, already parsed/defaulted by the
 *  server page. Shared by the server page (building Links) and the client
 *  controls (router.replace), so defaults drop out of URLs in exactly one
 *  place — parse and serialize share `PROGRESS_DEFAULTS` below. */
export type ProgressParams = {
  client: string;
  /** The roster's default client — `client` serializes only when it differs.
   *  Never serialized itself. */
  defaultClient: string;
  /** Which pane of the Clients hub: "metrics" (default), "tracking" (weigh-in
   *  entry, future calories/macros), "profile" (slow-changing fields), or
   *  "add" (new-person form, reached from the sidebar). */
  view: string;
  exercise: string;
  modality: string;
  repMin: number;
  repMax: number;
  weight: number;
  /** Lift-list filters: modality + muscle group ("" = no filter). */
  mod: string;
  group: MuscleGroupId | "";
};

export const PROGRESS_DEFAULTS = {
  view: "metrics",
  repMin: 8,
  repMax: 12,
  weight: 100,
} as const;

const VIEWS = new Set(["tracking", "profile", "add"]);

function clampInt(raw: string | undefined, fallback: number, min: number): number {
  const n = Number.parseInt(raw ?? "", 10);
  return Number.isFinite(n) && n >= min ? n : fallback;
}

/** Validate raw searchParams into ProgressParams. Unknown clients fall back
 *  to the roster's first client — never a hardcoded id, since clients are
 *  DB-backed rows now. */
export function parseProgressParams(
  raw: Record<string, string | undefined>,
  data: GymData,
): ProgressParams {
  const fallback = defaultClientId(data);
  const client =
    raw.client && data.clientById.has(raw.client) ? raw.client : fallback;
  const selected =
    raw.exercise && raw.modality && data.exerciseById.has(raw.exercise) && isModalityId(raw.modality)
      ? { exercise: raw.exercise, modality: raw.modality }
      : { exercise: "", modality: "" };
  return {
    client,
    defaultClient: fallback,
    view: raw.view && VIEWS.has(raw.view) ? raw.view : PROGRESS_DEFAULTS.view,
    ...selected,
    repMin: clampInt(raw.repMin, PROGRESS_DEFAULTS.repMin, 1),
    repMax: clampInt(raw.repMax, PROGRESS_DEFAULTS.repMax, 1),
    weight: clampInt(raw.weight, PROGRESS_DEFAULTS.weight, 0),
    mod: raw.mod && isModalityId(raw.mod) ? raw.mod : "",
    group: raw.group && isMuscleGroupId(raw.group) ? raw.group : "",
  };
}

export function progressHref(params: Partial<ProgressParams>): string {
  const qs = new URLSearchParams();
  if (params.client && params.client !== params.defaultClient) qs.set("client", params.client);
  if (params.view && params.view !== PROGRESS_DEFAULTS.view) qs.set("view", params.view);
  if (params.exercise) qs.set("exercise", params.exercise);
  if (params.modality) qs.set("modality", params.modality);
  if (params.repMin !== undefined && params.repMin !== PROGRESS_DEFAULTS.repMin) qs.set("repMin", String(params.repMin));
  if (params.repMax !== undefined && params.repMax !== PROGRESS_DEFAULTS.repMax) qs.set("repMax", String(params.repMax));
  if (params.weight !== undefined && params.weight !== PROGRESS_DEFAULTS.weight) qs.set("weight", String(params.weight));
  if (params.mod) qs.set("mod", params.mod);
  if (params.group) qs.set("group", params.group);
  const s = qs.toString();
  return `/users${s ? `?${s}` : ""}`;
}
