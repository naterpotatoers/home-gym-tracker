import { redirect } from "next/navigation";

/** The launcher moved to the home page; /workout/* routes stay. */
export default function WorkoutPage() {
  redirect("/");
}
