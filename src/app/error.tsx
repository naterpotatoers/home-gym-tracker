"use client";
import { Button, PageShell } from "@/components/ui";

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
      <p className="mt-3 text-sm text-muted">
        {error.message || "An unexpected error occurred."}
      </p>
      <p className="mt-1 text-xs text-muted">
        If this mentions a missing table, the database schema hasn&apos;t been
        applied — run supabase/schema.sql in the Supabase SQL editor.
      </p>
      <Button onClick={() => unstable_retry()} className="mt-5">
        Retry
      </Button>
    </PageShell>
  );
}
