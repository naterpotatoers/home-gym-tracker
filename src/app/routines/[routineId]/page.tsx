import { notFound } from "next/navigation";
import { RoutineEditor } from "@/components/routine-editor";
import { PageShell } from "@/components/ui";
import { loadGymData } from "@/lib/db/snapshot";
import { availableVariants, recentVariantKeys } from "@/lib/queries";

export default async function RoutinePage({
  params,
}: {
  params: Promise<{ routineId: string }>;
}) {
  const { routineId } = await params;
  const data = await loadGymData();
  const routine = data.routineById.get(routineId);
  if (!routine) notFound();

  return (
    <PageShell>
      <RoutineEditor
        routine={routine}
        initialRows={data.exercisesByRoutine.get(routineId) ?? []}
        variants={availableVariants()}
        recentKeys={recentVariantKeys(data)}
      />
    </PageShell>
  );
}
