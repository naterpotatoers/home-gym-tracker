import Link from "next/link";
import { PersonIcon, PlayIcon } from "@/components/icons";
import { chipClass, PageShell } from "@/components/ui";

/** App-wide 404 — unmatched URLs and notFound() alike (most often an old link
 *  to a session that has since been finished or discarded). */
export default function NotFound() {
  return (
    <PageShell>
      <h1 className="text-3xl font-bold tracking-tight">Not found</h1>
      <p className="mt-2 text-sm text-muted">
        That page or session doesn&apos;t exist — it may have been finished or discarded.
      </p>
      <div className="mt-6 flex flex-wrap gap-2">
        <Link href="/" className={chipClass(false, "min-h-11 px-4 text-sm")}>
          <PlayIcon size={16} /> Workout
        </Link>
        <Link href="/users" className={chipClass(false, "min-h-11 px-4 text-sm")}>
          <PersonIcon size={16} /> Clients
        </Link>
      </div>
    </PageShell>
  );
}
