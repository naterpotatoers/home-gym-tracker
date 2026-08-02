"use client";
import { PageShell } from "@/components/ui";


export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <PageShell>
      <h1 className="text-2xl font-bold tracking-tight">Something broke</h1>
      <p className="mt-3 text-sm opacity-70">
        {error.message || "An unexpected error occurred."}
      </p>
      <p className="mt-1 text-xs opacity-50">
        If this mentions a missing table, the database migration hasn&apos;t run —
        see /dev/seed.
      </p>
      <button
        type="button"
        onClick={() => unstable_retry()}
        className="mt-5 inline-flex min-h-11 items-center rounded-md bg-accent-strong px-4 text-sm font-semibold text-accent-fg hover:opacity-90"
      >
        Retry
      </button>
    </PageShell>
  );
}
