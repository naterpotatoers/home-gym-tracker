import { redirect } from "next/navigation";

/** Routines merged into the Plan page; detail routes under /routines/[id]
 *  are unaffected. */
export default function RoutinesPage() {
  redirect("/programs");
}
