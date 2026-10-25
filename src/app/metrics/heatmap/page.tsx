import { redirect } from "next/navigation";

/** The standalone heat map merged into the Clients hub's Progress tab
 *  ("Muscle work"); prescribed coverage lives on /programs/[id]. Old links
 *  keep their person and, where it maps, their period. */
export default async function HeatmapPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const raw = await searchParams;
  const qs = new URLSearchParams({ view: "metrics" });
  if (raw.client) qs.set("client", raw.client);
  if (raw.period === "program") qs.set("span", "program");
  redirect(`/users?${qs.toString()}`);
}
