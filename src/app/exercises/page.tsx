import Link from "next/link";
import { ArrowLeftIcon, PlusIcon } from "@/components/icons";
import {
  buttonClass,
  Card,
  Caret,
  chipClass,
  Note,
  PageShell,
  summaryClass,
} from "@/components/ui";
import {
  importSeedExercises,
  resyncSeedCatalogScores,
} from "@/lib/actions/exercises";
import { exercises as seedExercises } from "@/lib/data/exercises";
import { modalityById } from "@/lib/data/modalities";
import { MUSCLE_GROUP_COLORS } from "@/lib/data/muscles";
import { loadGymData } from "@/lib/db/snapshot";
import { primaryMuscle } from "@/lib/progress";
import {
  catalogSlice,
  PATTERN_LABELS,
  PATTERN_ORDER,
} from "@/lib/exercise-catalog";
import { AddExerciseForm } from "./_components/add-exercise-form";
import { ExerciseEditor } from "./_components/exercise-editor";
import { ExerciseTable, type ExerciseTableRow } from "./_components/exercise-table";
import { MaintenanceSubmit } from "./_components/maintenance-submit";
import { GuardedLink, UnsavedGuardProvider } from "./_components/unsaved-guard";

/**
 * The exercise catalog (the Library tab): one dense, filterable table of
 * every movement; a row opens its full editor — basics, muscle scores (as
 * roles), and modality variants. Every state is in the URL: the table,
 * ?exercise=<id> (editor), or ?add=1 (new-exercise form).
 */
export default async function ExercisesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const raw = await searchParams;
  const data = await loadGymData();
  const readOnly = data.exercisesSource === "seed";
  const selectedId =
    raw.exercise && data.exerciseById.has(raw.exercise) ? raw.exercise : null;
  const selected = selectedId ? data.exerciseById.get(selectedId) : undefined;
  const catalogEmpty = data.exercises.length === 0;
  const adding = raw.add !== undefined;

  const migrationNote = readOnly && (
    <p className="mb-6 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs">
      The exercise tables don&apos;t exist yet — run{" "}
      <code className="font-mono">supabase/schema.sql</code> in the
      Supabase SQL editor once, then import the catalog here. Until then this
      page is read-only.
    </p>
  );

  const addCard = (
    <Card className="mt-4">
      <h2 className="mb-3 text-lg font-semibold">
        Add an exercise
      </h2>
      {readOnly ? (
        <Note>Run the migration above first — the catalog is read-only.</Note>
      ) : (
        <AddExerciseForm
          existing={data.exercises.map((e) => ({
            name: e.name,
            aliases: e.aliases ?? [],
          }))}
        />
      )}
    </Card>
  );

  // Import only while the table is empty; Re-sync only once it isn't.
  const maintenance = !readOnly && (
    <details
      className="group mt-8 rounded-xl border border-border bg-surface"
      open={catalogEmpty}
    >
      <summary className={summaryClass("rounded-xl px-4 py-2 text-sm font-semibold")}>
        <Caret /> Catalog maintenance
      </summary>
      <div className="border-t border-border px-4 py-3">
        {catalogEmpty ? (
          <>
            <h2 className="mb-2 font-semibold">Import the seed catalog</h2>
            <p className="mb-3 text-sm text-muted">
              The exercise tables are empty. Import the built-in catalog (
              {seedExercises.length} exercises with muscle scores and equipment
              variants) to start.
            </p>
            <form action={importSeedExercises}>
              <MaintenanceSubmit
                variant="primary"
                label="Import seed catalog"
                pendingLabel="Importing…"
              />
            </form>
          </>
        ) : (
          <>
            <h2 className="mb-2 font-semibold">Re-sync the seed catalog</h2>
            <p className="mb-3 text-sm text-muted">
              Adds any built-in exercises missing from your catalog, then
              overwrites muscle scores and alternative names for all{" "}
              {seedExercises.length} built-ins with the app&apos;s current seed
              values — use after a seed correction or new built-ins land. Any
              score edits you made to built-ins are discarded; custom
              exercises, names, and equipment variants are untouched.
            </p>
            <form action={resyncSeedCatalogScores}>
              <MaintenanceSubmit
                label="Re-sync seed scores & aliases"
                pendingLabel="Re-syncing…"
                confirmText={`Overwrite muscle scores and alternative names for all ${seedExercises.length} built-in exercises with the seed values? Any score edits you made to built-ins will be lost.`}
              />
            </form>
          </>
        )}
      </div>
    </details>
  );

  const backLink = (
    <GuardedLink
      href="/exercises"
      className={chipClass(false, "min-h-9 pointer-coarse:min-h-11 px-2.5 text-xs")}
    >
      <ArrowLeftIcon size={14} /> Library
    </GuardedLink>
  );

  const rows: ExerciseTableRow[] = [...data.exercises]
    .sort(
      (a, b) =>
        PATTERN_ORDER.indexOf(a.pattern) - PATTERN_ORDER.indexOf(b.pattern) ||
        a.name.localeCompare(b.name),
    )
    .map((e) => {
      const primary = primaryMuscle(data, e.id);
      return {
        id: e.id,
        name: e.name,
        aliases: e.aliases ?? [],
        pattern: e.pattern,
        patternLabel: PATTERN_LABELS[e.pattern],
        patternOrder: PATTERN_ORDER.indexOf(e.pattern),
        gear: (data.modalitiesByExercise.get(e.id) ?? []).map(
          (m) => modalityById.get(m.modalityId)?.name ?? m.modalityId,
        ),
        primaryMuscle: primary?.name ?? null,
        groupColor: primary ? MUSCLE_GROUP_COLORS[primary.groupId] : null,
      };
    });

  return (
    <PageShell>
      {migrationNote}
      <UnsavedGuardProvider>
        {selected ? (
          <>
            {backLink}
            <ExerciseEditor
              key={selected.id}
              exercise={selected}
              initialScores={data.scoresByExercise.get(selected.id) ?? []}
              initialModalities={data.modalitiesByExercise.get(selected.id) ?? []}
              catalog={catalogSlice(data)}
              readOnly={readOnly}
            />
          </>
        ) : adding ? (
          <>
            {backLink}
            {addCard}
          </>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h1 className="text-3xl font-bold tracking-tight">Library</h1>
              {!readOnly && (
                <Link href="/exercises?add=1" className={buttonClass("primary")}>
                  <PlusIcon size={16} /> New exercise
                </Link>
              )}
            </div>
            <div className="mt-6">
              <ExerciseTable
                rows={rows}
                patterns={PATTERN_ORDER.map((id) => ({ id, label: PATTERN_LABELS[id] }))}
              />
            </div>
            {maintenance}
          </>
        )}
      </UnsavedGuardProvider>
    </PageShell>
  );
}
