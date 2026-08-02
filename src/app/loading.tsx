import { PageShell } from "@/components/ui";
export default function Loading() {
  return (
    <PageShell>
      <div className="h-8 w-64 animate-pulse rounded bg-current/10" />
      <div className="mt-6 space-y-3">
        <div className="h-4 w-full animate-pulse rounded bg-current/5" />
        <div className="h-4 w-5/6 animate-pulse rounded bg-current/5" />
        <div className="h-4 w-4/6 animate-pulse rounded bg-current/5" />
      </div>
    </PageShell>
  );
}
