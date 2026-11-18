import { redirect } from "next/navigation";

/** The standalone heat map became the Library's muscle explorer (learn a
 *  muscle, see what trains it); prescribed coverage lives on
 *  /programs/[id]. */
export default function HeatmapPage() {
  redirect("/exercises?view=muscles");
}
