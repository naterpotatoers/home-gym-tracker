import { notFound } from "next/navigation";
import { RoutineEditor } from "@/components/routine-editor";
import { SeedBanner } from "@/components/ui";
import { loadGymData } from "@/lib/db/snapshot";
import { availableVariants } from "@/lib/queries";

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
    <main className="mx-auto w-full max-w-5xl px-6 py-10 font-sans">
      {data.source === "seed" && <SeedBanner />}
      <RoutineEditor
        routine={routine}
        initialRows={data.exercisesByRoutine.get(routineId) ?? []}
        variants={availableVariants()}
      />
    </main>
  );
}
