"use client";

export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-16 font-sans">
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
        className="mt-5 rounded border border-current/20 px-4 py-1.5 text-sm font-semibold hover:bg-current/10"
      >
        Retry
      </button>
    </main>
  );
}
