export default function Loading() {
  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-10 font-sans">
      <div className="h-8 w-64 animate-pulse rounded bg-current/10" />
      <div className="mt-6 space-y-3">
        <div className="h-4 w-full animate-pulse rounded bg-current/5" />
        <div className="h-4 w-5/6 animate-pulse rounded bg-current/5" />
        <div className="h-4 w-4/6 animate-pulse rounded bg-current/5" />
      </div>
    </main>
  );
}
