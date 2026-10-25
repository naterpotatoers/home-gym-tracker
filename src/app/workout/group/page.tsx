import { redirect } from "next/navigation";

/** Setup merged into the home launcher; the live board stays at /workout/group/board. */
export default function GroupSetupPage() {
  redirect("/");
}
