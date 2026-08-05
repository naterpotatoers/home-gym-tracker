import { redirect } from "next/navigation";

/** Progress merged into the People page (person hub); the heat map keeps
 *  living at /metrics/heatmap. Old links carry their full query state over. */
export default async function MetricsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const raw = await searchParams;
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(raw)) {
    if (value !== undefined) qs.set(key, value);
  }
  const s = qs.toString();
  redirect(`/users${s ? `?${s}` : ""}`);
}
