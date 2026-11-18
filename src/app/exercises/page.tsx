import Link from "next/link";
import { ArrowLeftIcon, PlusIcon } from "@/components/icons";
import { backLinkClass, buttonClass, Card, ChipTabs, Note, PageShell } from "@/components/ui";
import { modalityById } from "@/lib/data/modalities";
import { MUSCLE_GROUP_COLORS } from "@/lib/data/muscles";
import { isMuscleId } from "@/lib/validate";
import { loadGymData } from "@/lib/db/snapshot";
import { primaryMuscle } from "@/lib/progress";
import { catalogSlice, PATTERN_LABELS, PATTERN_ORDER } from "@/lib/exercise-catalog";
import { AddExerciseForm } from "./_components/add-exercise-form";
import { ExerciseEditor } from "./_components/exercise-editor";
import { ExerciseTable, type ExerciseTableRow } from "./_components/exercise-table";
import { MuscleExplorer } from "./_components/muscle-explorer";
import { CatalogMaintenance } from "./_components/catalog-maintenance";
import { GuardedLink, UnsavedGuardProvider } from "./_components/unsaved-guard";

/**
 * The exercise catalog (the Library tab): one dense, filterable table of
 * every movement; a row opens its full editor — basics, muscle scores (as
 * roles), and modality variants. The Muscles view is the body explorer:
 * what each muscle does and what trains it. Every state is in the URL: the
 * table, ?view=muscles(&muscle=<id>), ?exercise=<id> (editor), or ?add=1
 * (new-exercise form).
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
  const musclesView = raw.view === "muscles";
  const initialMuscle = raw.muscle && isMuscleId(raw.muscle) ? raw.muscle : null;

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

  const backLink = (
    <GuardedLink
      href="/exercises"
      className={backLinkClass}
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
              {!readOnly && !musclesView && (
                <Link href="/exercises?add=1" className={buttonClass("primary")}>
                  <PlusIcon size={16} /> New exercise
                </Link>
              )}
            </div>
            <ChipTabs
              label="Library view"
              className="mt-4"
              tabs={[
                { href: "/exercises", label: "Exercises", current: !musclesView },
                { href: "/exercises?view=muscles", label: "Muscles", current: musclesView },
              ]}
            />
            {musclesView ? (
              <div className="mt-6">
                <MuscleExplorer catalog={catalogSlice(data)} initialMuscle={initialMuscle} />
              </div>
            ) : (
              <>
                <div className="mt-6">
                  <ExerciseTable
                    rows={rows}
                    patterns={PATTERN_ORDER.map((id) => ({ id, label: PATTERN_LABELS[id] }))}
                  />
                </div>
                {!readOnly && <CatalogMaintenance catalogEmpty={catalogEmpty} />}
              </>
            )}
          </>
        )}
      </UnsavedGuardProvider>
    </PageShell>
  );
}
