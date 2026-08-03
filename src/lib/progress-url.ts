/** The Progress page's full URL state, already parsed/defaulted by the
 *  server page. Shared by the server page (building Links) and the client
 *  controls (router.replace), so defaults drop out of URLs in exactly one
 *  place. */
export type ProgressParams = {
  client: string;
  exercise: string;
  modality: string;
  repMin: number;
  repMax: number;
  weight: number;
  sort: string;
  filter: string;
  /** Lift-list filters: modality + muscle group. */
  mod: string;
  group: string;
};

export function progressHref(params: Partial<ProgressParams>): string {
  const qs = new URLSearchParams();
  if (params.client && params.client !== "nate") qs.set("client", params.client);
  if (params.exercise) qs.set("exercise", params.exercise);
  if (params.modality) qs.set("modality", params.modality);
  if (params.repMin !== undefined && params.repMin !== 8) qs.set("repMin", String(params.repMin));
  if (params.repMax !== undefined && params.repMax !== 12) qs.set("repMax", String(params.repMax));
  if (params.weight !== undefined && params.weight !== 100) qs.set("weight", String(params.weight));
  if (params.sort && params.sort !== "group") qs.set("sort", params.sort);
  if (params.filter && params.filter !== "all") qs.set("filter", params.filter);
  if (params.mod) qs.set("mod", params.mod);
  if (params.group) qs.set("group", params.group);
  const s = qs.toString();
  return `/metrics${s ? `?${s}` : ""}`;
}
