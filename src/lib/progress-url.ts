import type { GymData } from "./gym-data";
import { defaultClientId } from "./queries";
import { isModalityId } from "./validate";

/** The Progress page's full URL state, already parsed/defaulted by the
 *  server page. Shared by the server page (building Links) and the client
 *  controls (router.replace), so defaults drop out of URLs in exactly one
 *  place — parse and serialize share `PROGRESS_DEFAULTS` below. */
export type ProgressParams = {
  client: string;
  /** The roster's default client — `client` serializes only when it differs.
   *  Never serialized itself. */
  defaultClient: string;
  /** Which pane of the Clients hub: "metrics" (default; labelled Progress),
   *  "cardio" (runs + Echo Bike), "tracking" (labelled Log — body weight +
   *  food), "profile" (slow-changing fields), or "add" (new-person form,
   *  reached from the sidebar). The URL values predate the labels and stay
   *  so old links keep working. */
  view: string;
  exercise: string;
  modality: string;
};

export const PROGRESS_DEFAULTS = {
  view: "metrics",
} as const;

const VIEWS = new Set(["cardio", "tracking", "profile", "add"]);

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
  };
}

export function progressHref(params: Partial<ProgressParams>): string {
  const qs = new URLSearchParams();
  if (params.client && params.client !== params.defaultClient) qs.set("client", params.client);
  if (params.view && params.view !== PROGRESS_DEFAULTS.view) qs.set("view", params.view);
  if (params.exercise) qs.set("exercise", params.exercise);
  if (params.modality) qs.set("modality", params.modality);
  const s = qs.toString();
  return `/users${s ? `?${s}` : ""}`;
}
