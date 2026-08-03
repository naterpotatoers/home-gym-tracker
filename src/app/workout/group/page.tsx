import { redirect } from "next/navigation";

/** Setup merged into /workout; the live board stays at /workout/group/board. */
export default function GroupSetupPage() {
  redirect("/workout");
}
