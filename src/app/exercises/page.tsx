import Link from "next/link";
import { PlusIcon } from "@/components/icons";
import { Button, Card, Note, PageShell } from "@/components/ui";
import {
  importSeedExercises,
  resyncSeedCatalogScores,
} from "@/lib/actions/exercises";
import { exercises as seedExercises } from "@/lib/data/exercises";
import { loadGymData } from "@/lib/db/snapshot";
import {
  catalogSlice,
  PATTERN_LABELS,
  PATTERN_ORDER,
} from "@/lib/exercise-catalog";
import { AddExerciseForm } from "./_components/add-exercise-form";
import { ExerciseEditor } from "./_components/exercise-editor";

/**
 * The exercise catalog: every movement the app knows, grouped by pattern,
 * with full authoring — basics, muscle scores (as roles), and modality
 * variants. Selection lives in the URL (?exercise=<id>) so every state is
 * linkable, like /users.
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

  const migrationNote = readOnly && (
    <p className="mb-6 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs">
      The exercise tables don&apos;t exist yet — run{" "}
      <code className="font-mono">supabase/schema.sql</code> in the
      Supabase SQL editor once, then import the catalog here. Until then this
      page is read-only.
    </p>
  );

  const importCard = !readOnly && data.exercises.length === 0 && (
    <Card className="mt-4">
      <h2 className="mb-2 text-lg font-semibold">Import the seed catalog</h2>
      <p className="mb-3 text-sm text-muted">
        The exercise tables are empty. Import the built-in catalog (
        {seedExercises.length} exercises with muscle scores and equipment
        variants) to start.
      </p>
      <form action={importSeedExercises}>
        <Button type="submit" variant="primary" size="sm">
          Import seed catalog
        </Button>
      </form>
    </Card>
  );

  const addCard = (
    <Card className="mt-4">
      <h2 className="mb-3 text-lg font-semibold">Add an exercise</h2>
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

  const resyncCard = !readOnly && data.exercises.length > 0 && (
    <Card className="mt-4">
      <h2 className="mb-2 text-lg font-semibold">Re-sync the seed catalog</h2>
      <p className="mb-3 text-sm text-muted">
        Adds any built-in exercises missing from your catalog, then overwrites
        muscle scores and alternative names for all {seedExercises.length}{" "}
        built-ins with the app&apos;s current seed values — use after a seed
        correction or new built-ins land. Any score edits you made to
        built-ins are discarded; custom exercises, names, and equipment
        variants are untouched.
      </p>
      <form action={resyncSeedCatalogScores}>
        <Button type="submit" size="sm">
          Re-sync seed scores &amp; aliases
        </Button>
      </form>
    </Card>
  );

  const grouped = PATTERN_ORDER.map((pattern) => ({
    pattern,
    exercises: data.exercises
      .filter((e) => e.pattern === pattern)
      .sort((a, b) => a.name.localeCompare(b.name)),
  })).filter((g) => g.exercises.length > 0);

  return (
    <PageShell>
      {migrationNote}
      <h1 className="text-3xl font-bold tracking-tight">Exercises</h1>
      {importCard}

      <div className="mt-6 space-y-4 lg:grid lg:grid-cols-[16rem_1fr] lg:gap-8 lg:space-y-0">
        <aside>
          <Link
            href="/exercises"
            className={`flex min-h-11 items-center gap-2 rounded-md px-2 text-sm font-semibold ${
              selectedId === null
                ? "bg-accent-soft text-accent-text"
                : "hover:bg-current/5"
            }`}
          >
            <PlusIcon size={16} /> Add exercise
          </Link>
          <nav className="mt-2 max-h-[70vh] overflow-y-auto pr-1">
            {grouped.map(({ pattern, exercises }) => (
              <div key={pattern} className="mt-3">
                <h3 className="mb-1 px-2 text-xs font-semibold uppercase tracking-wide text-muted">
                  {PATTERN_LABELS[pattern]}
                </h3>
                <ul>
                  {exercises.map((exercise) => (
                    <li key={exercise.id}>
                      <Link
                        href={`/exercises?exercise=${exercise.id}`}
                        className={`flex min-h-11 items-center rounded-md px-2 text-sm ${
                          exercise.id === selectedId
                            ? "bg-accent-soft font-semibold text-accent-text"
                            : "hover:bg-current/5"
                        }`}
                      >
                        {exercise.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </aside>

        <main className="min-w-0">
          {selected ? (
            <ExerciseEditor
              key={selected.id}
              exercise={selected}
              initialScores={data.scoresByExercise.get(selected.id) ?? []}
              initialModalities={data.modalitiesByExercise.get(selected.id) ?? []}
              catalog={catalogSlice(data)}
              readOnly={readOnly}
            />
          ) : (
            <>
              {addCard}
              {resyncCard}
            </>
          )}
        </main>
      </div>
    </PageShell>
  );
}
